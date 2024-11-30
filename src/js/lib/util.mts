import { GenerateBlackList } from "./GenerateContext.mjs";

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

export function checkExclude(def: CS.CppAst.CppField | CS.CppAst.CppFunction | CS.CppAst.CppClass, exclude: GenerateBlackList) {
    if (def.constructor == CS.CppAst.CppField || def.constructor == CS.CppAst.CppFunction) {
        return !!exclude.members.filter((fullName) => {
            const tempSplit = fullName.split('::');
            const ns = tempSplit.slice(0, -1).join('::');
            const name = tempSplit[tempSplit.length - 1];
    
            return def.Name == name && def.FullParentName == ns;
        }).length

    } else if (def.constructor == CS.CppAst.CppClass) {
        if (exclude.types.indexOf(def.FullName) != -1) return true;
        if (exclude.namespaces.filter((ns) => {
            if (def.FullName.indexOf(ns) != -1) return true;
        }).length) return true;
    }
}