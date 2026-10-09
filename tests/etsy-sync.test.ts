import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderedImages, parseVariations, type EtsyListing } from '../lib/etsy'
import { saveEtsyProduct } from '../lib/etsy-sync'
import { overallReviewAverage } from '../lib/review-stats'
import type { PrismaClient } from '@prisma/client'

const listing = (detail: object) => ({ listing_id: 1, ...detail }) as EtsyListing
const product = { product_id: 123, property_values: [{ property_name: 'Color', values: ['Blue'] }], offerings: [{ quantity: 2, is_enabled: true, price: { amount: 1200, divisor: 100, currency_code: 'USD' } }] }

test('missing or truncated inventory is distinct from confirmed no options', () => {
  for (const detail of [undefined, listing({}), listing({ inventory: null }), listing({ inventory: {} }), listing({ inventory: { products: [{ ...product, offerings: undefined }] } }), listing({ inventory: { products: [{ ...product, property_values: undefined }] } }), listing({ has_variations: true, inventory: { products: [] } })]) {
    assert.equal(parseVariations(detail), null)
  }
  assert.deepEqual(parseVariations(listing({ has_variations: false })), [])
  assert.deepEqual(parseVariations(listing({ inventory: { products: [{ ...product, property_values: [] }] } })), [])
})

test('complete options include disabled and sold-out choices', () => {
  const result = parseVariations(listing({ inventory: { products: [{ ...product, offerings: [{ ...product.offerings[0], quantity: 0, is_enabled: false }] }] } }))
  assert.equal(result?.[0].label, 'Blue')
  assert.equal(result?.[0].quantity, 0)
  assert.equal(result?.[0].isEnabled, false)
  assert.equal(result?.[0].price, 12)
})

test('invalid gallery rejects the whole replacement; valid photos keep Etsy rank', () => {
  assert.equal(orderedImages(undefined), null)
  assert.equal(orderedImages(listing({ images: [{ url_570xN: 'https://i.etsystatic.com/valid.jpg' }, { url_570xN: 'javascript:alert(1)' }] })), null)
  assert.equal(orderedImages(listing({ images: [{ url_570xN: 'https://i.etsystatic.com/a', fullUrl: 'bad', url_fullxfull: 'bad' }] })), null)
  assert.deepEqual(orderedImages(listing({ images: [] })), [])
  assert.deepEqual(orderedImages(listing({ images: [{ rank: 2, url_fullxfull: 'https://i.etsystatic.com/b.jpg' }, { rank: 1, url_570xN: 'https://i.etsystatic.com/a.jpg' }] }))?.map(i => i.url), ['https://i.etsystatic.com/a.jpg', 'https://i.etsystatic.com/b.jpg'])
})

// Transactional test double: only commit the candidate state when the callback
// succeeds. Production uses Prisma's database-backed interactive transaction.
function database(failInsert = false) {
  let state = { images: ['old-photo'], variations: ['old-option'], thumbnail: 'old-thumbnail' }
  const db = { async $transaction(callback: (tx: unknown) => Promise<unknown>) {
    const draft = structuredClone(state)
    const tx = {
      product: { async update({ data }: { data: { imageUrl?: string } }) { draft.thumbnail = data.imageUrl ?? draft.thumbnail; return { id: 'product-1' } } },
      productImage: {
        async deleteMany() { draft.images = [] },
        async createMany({ data }: { data: { url: string }[] }) { if (failInsert) throw new Error('image insertion failed'); draft.images = data.map(i => i.url) },
      },
      productVariation: {
        async deleteMany() { draft.variations = [] },
        async createMany({ data }: { data: { label: string }[] }) { draft.variations = data.map(v => v.label) },
      },
    }
    const result = await callback(tx)
    state = draft
    return result
  } } as unknown as Pick<PrismaClient, '$transaction'>
  return { db, read: () => state }
}
const data = { name: 'Product', price: 12, imageUrl: 'new-thumbnail' }
const gallery = [{ url: 'new-photo', fullUrl: null, etsyImageId: null }]

test('failed gallery insert rejects sync and retains photos, options, and thumbnail', async () => {
  const { db, read } = database(true)
  await assert.rejects(saveEtsyProduct(db, '1', true, data, gallery, []), /image insertion failed/)
  assert.deepEqual(read(), { images: ['old-photo'], variations: ['old-option'], thumbnail: 'old-thumbnail' })
})

test('partial sync keeps options and gallery; confirmed no options clears saved choices', async () => {
  const { db, read } = database()
  await saveEtsyProduct(db, '1', true, { name: 'Product', price: 12 }, null, null)
  assert.deepEqual(read(), { images: ['old-photo'], variations: ['old-option'], thumbnail: 'old-thumbnail' })
  await saveEtsyProduct(db, '1', true, data, gallery, [])
  assert.deepEqual(read(), { images: ['new-photo'], variations: [], thumbnail: 'new-thumbnail' })
})

test('overall rating weights every review equally, including empty and single-product cases', () => {
  assert.equal(overallReviewAverage([{ avgRating: 5, reviewCount: 1 }, { avgRating: 1, reviewCount: 100 }]), 105 / 101)
  assert.equal(overallReviewAverage([{ avgRating: 4.5, reviewCount: 2 }]), 4.5)
  assert.equal(overallReviewAverage([{ avgRating: 0, reviewCount: 0 }]), null)
})

test('malformed offering entries preserve options instead of throwing', () => {
  assert.equal(parseVariations(listing({ inventory: { products: [{ ...product, offerings: [null, ...product.offerings] }] } })), null)
})

test('failed detail requests preserve the distinction between unavailable data and no options', async () => {
  const { fetchListingDetails } = await import('../lib/etsy')
  const originalFetch = globalThis.fetch
  const originalKey = process.env.ETSY_KEYSTRING
  const originalSecret = process.env.ETSY_SHARED_SECRET
  const originalError = console.error
  process.env.ETSY_KEYSTRING = 'test-key'
  process.env.ETSY_SHARED_SECRET = 'test-secret'
  globalThis.fetch = async () => new Response('upstream unavailable', { status: 503 })
  console.error = () => {}
  try {
    const details = await fetchListingDetails([1])
    assert.equal(details.size, 0)
    assert.equal(parseVariations(details.get(1)), null)
    assert.equal(orderedImages(details.get(1)), null)
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalError
    if (originalKey === undefined) delete process.env.ETSY_KEYSTRING
    else process.env.ETSY_KEYSTRING = originalKey
    if (originalSecret === undefined) delete process.env.ETSY_SHARED_SECRET
    else process.env.ETSY_SHARED_SECRET = originalSecret
  }
})
