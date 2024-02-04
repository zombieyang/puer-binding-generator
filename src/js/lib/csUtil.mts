
function csForEach(csList: any, callback: (item: any, index: number) => void) {
    const count = csList.Count;
    for (let i = 0; i < count; i++) {
        const item = csList.get_Item(i);
        callback(item, i);
    }
}
function csMap<T>(csList: any, callback: (item: any, index: number) => T): T[] {
    const count = csList.Count;
    const res: T[] = [];
    for (let i = 0; i < count; i++) {
        const item = csList.get_Item(i);
        res.push(callback(item, i));
    }
    return res;
}
function csWhere(csList: any, callback: (item: any, index: number) => boolean): boolean {
    const count = csList.Count;
    for (let i = 0; i < count; i++) {
        const item = csList.get_Item(i);
        if (callback(item, i)) return true;
    }
    return false;
}


export {
    csForEach,
    csMap,
    csWhere
}