import renderBinding from "./lib/render/binding.mjs";
import renderDeclaration from "./lib/render/dts.mjs";
import GenerateContext from "./lib/GenerateContext.mjs";

export default function render (
    compilation: CS.CppAst.CppCompilation,
    bindingOutputPath: string,
    dtsOutputPath: string,
    BindingConfig: any
) {
    if (bindingOutputPath.match(/\.[\w\d_]*$/)) {
        bindingOutputPath = bindingOutputPath.split('.').slice(0, -1).join('.');
    }
    const includes = BindingConfig.includes;
    const refExcludes = BindingConfig.refExcludes;
    const genExcludes = BindingConfig.genExcludes;
    const specialTSNames = BindingConfig.specialTSNames;
    const generateContext = new GenerateContext(compilation, refExcludes, genExcludes, specialTSNames);

    if (!includes || includes == '*') { 
        generateContext.findAllClass();
        
    } else {
        includes
            // do distinct
            .filter((value: string, index: number, arr: string[]) => arr.indexOf(value) == index)
            .forEach((signature: string) => {
                generateContext.addBaseUsage(signature);
            });

        if (!BindingConfig.skipExpand) {
            generateContext.expandCurrentUsage();
        }
    }

    const bindingContents = renderBinding(generateContext, bindingOutputPath.split('/').pop() || '', BindingConfig);
    const dtsContent = renderDeclaration(generateContext);

    CS.System.IO.File.WriteAllText(bindingOutputPath + ".hpp", bindingContents.header);
    CS.System.IO.File.WriteAllText(bindingOutputPath + ".cpp", bindingContents.source);
    CS.System.IO.File.WriteAllText(dtsOutputPath, dtsContent);
} 