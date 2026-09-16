export const ENTUR_URL = 'https://api.entur.io/journey-planner/v3/graphql'
export const CLIENT_NAME = 'ashklianko-ruteavvik'

export class EnturError extends Error {}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENTUR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT_NAME },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new EnturError(`Entur ${res.status}`)
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new EnturError(body.errors.map((e) => e.message).join('; '))
  if (!body.data) throw new EnturError('Entur returned no data')
  return body.data
}
