// #14: Discriminated union prevents illegal states like { success: true, error: "oops" }
export type ApiResponse<T> =
  | {
      success: true
      data: T
      meta?: {
        total?: number
        page?: number
        limit?: number
        cursor?: string
        nextCursor?: string | null
      }
    }
  | {
      success: false
      error: string
      details?: Array<{ path: string; message: string }>
    }
