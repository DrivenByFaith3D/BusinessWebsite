import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchShopListings, fetchListingDetails, type EtsyListing } from '../lib/etsy'
const draft = { listing_id: 1, state: 'draft', title: 'Unpublished print' } as EtsyListing
function reader(run: (path: string) => unknown) {
  return async <T>(path: string) => run(path) as T
}
test('private draft pagination reads every page including a short first page', async () => {
  const paths: string[] = []
  const rows = await fetchShopListings(10, 'draft', reader(path => {
    paths.push(path)
    return paths.length === 1 ? { count: 2, results: [draft] } : { count: 2, results: [{ ...draft, listing_id: 2 }] }
  }))
  assert.equal(rows.length, 2)
  assert.match(paths[0], /state=draft/)
  assert.match(paths[1], /offset=1/)
})
test('an incomplete or unauthorized draft snapshot cannot be used to hide saved drafts', async () => {
  await assert.rejects(fetchShopListings(10, 'draft', reader(() => ({ count: 2, results: [] }))), /pagination was incomplete/)
  await assert.rejects(fetchShopListings(10, 'draft', reader(() => ({ count: 1 }))), /response was incomplete/)
  await assert.rejects(fetchShopListings(10, 'draft', reader(() => { throw new Error('Etsy 403') })), /403/)
})
test('unexpected active rows cannot silently become drafts; Etsy edit rows stay unpublished', async () => {
  await assert.rejects(fetchShopListings(10, 'draft', reader(() => ({ count: 1, results: [{ ...draft, state: 'active' }] }))), /unexpected state/)
  const rows = await fetchShopListings(10, 'draft', reader(() => ({ count: 1, results: [{ ...draft, state: 'edit' }] })))
  assert.equal(rows[0].state, 'edit')
})
test('draft photos and personalization are fetched through the authorized reader', async () => {
  const paths: string[] = []
  const read = reader(path => {
    paths.push(path)
    return { results: [{ ...draft, images: [], inventory: null, shipping_profile: null }] }
  })
  const details = await fetchListingDetails([1], undefined, read, read)
  assert.equal(paths.length, 3)
  assert.ok(paths.some(path => path.includes('includes=Images,Videos,Personalization')))
  assert.deepEqual(details.get(1)?.images, [])
})
