import GenerateContext from "../GenerateContext.mjs";

export function renderPatchJS(
    generateContext: GenerateContext
) {
    let ret = "";
    const allEnumDict = generateContext.getAllUsedEnum();
    for (const enumm of allEnumDict) {
        ret += `
addTypePatch('${enumm.astEnum.FullParentName}', (type) => {
    type.${enumm.name} = {};
${
        Object.keys(enumm.enums).map(enumName => {
            return `    type.${enumm.name}['${enumName}'] = ${enumm.enums[enumName]};`
        }).join('\n')
    }
})
        `
    }

    return ret;
}