const _getDateFilter = (options: {
    to?: Date
    from?: Date
    fieldName?: string
    defaultFromOffsetMs?: number
}) => {
    const to: Date = options?.to ?? (new Date) // default now
    const from: Date = options?.from ?? (new Date(to.getTime() - (options.defaultFromOffsetMs ?? 7 * 24 * 60 * 60 * 1000))) // 1 week ago

    return {
        [options.fieldName ?? 'createdAt']: {
            '$lte': new Date(to.setUTCHours(23, 59, 59)),
            '$gte': new Date(from.setUTCHours(0, 0))
        }
    }
}

export default _getDateFilter