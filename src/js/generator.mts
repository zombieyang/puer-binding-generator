//@ts-ignore
import BindingConfig from "binding.config.js";
import renderBinding from "./lib/render/binding.mjs";
import renderDeclaration from "./lib/render/declaration.mjs";
import UsageCollector from "./lib/UsageCollector.mjs";

export default function render (
    compilation: CS.CppAst.CppCompilation,
    bindingOutputPath: string,
    dtsOutputPath: string,
    bindingFunctionName: string
) {
    const usageExpander = new UsageCollector(compilation);
    const whiteList = BindingConfig.whitelist;

    whiteList
        // do distinct
        .filter((value: string, index: number, arr: string[]) => arr.indexOf(value) == index)
        .forEach((signature: string) => {
            usageExpander.addBaseUsage(signature);
        });
    usageExpander.expandCurrentUsage();

    const bindingContent = renderBinding(usageExpander, BindingConfig, bindingFunctionName);
    const dtsContent = renderDeclaration(usageExpander);

    CS.System.IO.File.WriteAllText(bindingOutputPath, bindingContent);
    CS.System.IO.File.WriteAllText(dtsOutputPath, dtsContent);
} 