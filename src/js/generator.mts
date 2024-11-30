import renderBinding from "./lib/render/binding.mjs";
import renderDTS from "./lib/render/dts.mjs";
import GenerateContext from "./lib/GenerateContext.mjs";
import { renderPatchJS } from "./lib/render/patchjs.mjs";

export default function render (
    compilation: CS.CppAst.CppCompilation,
    BindingConfig: any
) {
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

    if (!BindingConfig.output) throw new Error('output is not defined in BindingConfig');
    let bindingOutputPath = BindingConfig.output.binding.replace(/\\/g, '/');
    let dtsOutputPath = BindingConfig.output.dts.replace(/\\/g, '/');
    let patchJSOutputPath = BindingConfig.output.patchjs.replace(/\\/g, '/');
    if (bindingOutputPath.match(/\.[\w\d_]*$/)) {
        bindingOutputPath = bindingOutputPath.split('.').slice(0, -1).join('.');
    }

    const bindingContents = renderBinding(generateContext, bindingOutputPath.split('/').pop() || '', BindingConfig);
    const dtsContent = renderDTS(generateContext);
    const patchJSContent = renderPatchJS(generateContext)

    CS.System.IO.File.WriteAllText(bindingOutputPath + ".hpp", bindingContents.header);
    CS.System.IO.File.WriteAllText(bindingOutputPath + ".cpp", bindingContents.source);
    CS.System.IO.File.WriteAllText(dtsOutputPath, dtsContent);
    CS.System.IO.File.WriteAllText(patchJSOutputPath, patchJSContent);
} 