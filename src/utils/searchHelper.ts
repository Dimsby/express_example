import * as helper from '../helper'
import express from "express";

export const getSearchCriteria = (value) => ({
    $regex: '.*' + helper.escapeRegex(value as string) + '.*',
    $options: 'i'
})

export const getUniqueCriteria = (value) => ({
    $regex: helper.escapeRegex(value as string),
    $options: 'i'
})

/**
 * Returns mongodb filters for all `fields` from `input`
 * @param input
 * @param fields
 * @param exact
 * @param prefix
 */
export const getSearchFilters = (
    input: {[key: string]: any},
    fields: string[],
    exact: boolean = false,
    prefix?: string
) => {
    const filter = {}
    fields.forEach((field) => {
        let value: string|boolean = input[field]
        if (value) {
            if (value === 'true') value = true
                else if (value === 'false') value = false
            filter[prefix ? `${prefix}.${field}` : field] = exact ? value : getSearchCriteria(value)
        }
    })
    return filter
}

/**
 * Returns mongodb filters for date `fields` from `input`
 * @param input
 * @param fields
 * @param prefix
 */
export const getDateFilters = (
    input: {[key: string]: any},
    fields: string[]|string,
    prefix?: string
) => {
    const filter = {}
    if (!Array.isArray(fields)) fields = [fields]

    fields.forEach((field) => {
        const valueStart: string = input[`${field}Start`]
        const valueEnd: string = input[`${field}End`]
        if (!valueStart && !valueEnd) return

        if (prefix)
            field = `${prefix}.${field}`

        filter[field] = {}
        if (valueStart)
            filter[field]['$gte'] = new Date(`${valueStart} 0:00`)
        if (valueEnd)
            filter[field]['$lte'] = new Date(`${valueEnd} 23:59:59`)
    })

    return filter
}

/**
 * Returns query string for request
 * @param data
 */
export const getQueryString = (data: object): string => {
    const params = new URLSearchParams()

    for (const k in data) {
        const v: string = data[k] as string
        if (!v) continue
        params.append(k, v)
    }

    return params.toString()
}