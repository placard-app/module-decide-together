export type Place = {
  id: string
  name: string
  category: string
  visibility: string
  coverThumbUrl?: string | null
  facts?: {
    openingHours?: {
      weekdayDescriptions?: string[]
      periods: {
        open: { day: number; hour: number; minute: number }
        close?: { day: number; hour: number; minute: number }
      }[]
    } | null
    fromGoogle?: boolean
  }
}
export type Poll = {
  id: string
  title: string
  organizerId: string
  revealed: boolean
  options: { placeId: string; place: Place | null; count?: number; winner?: boolean }[]
  ownVote: string | null
  ballotCount: number
}
