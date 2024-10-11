
export const filterDoc = (doc: object, filterKeys: string[]) => {
    return filterKeys.reduce((obj, key) => ({...obj, [key]: doc[key]}), {});
}

export const deleteInDoc = (doc: object, toDeleteKeys: string[]) => {
    toDeleteKeys.forEach((v) => delete doc[v])
    return doc
}
