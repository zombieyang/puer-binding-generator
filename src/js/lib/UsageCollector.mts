import { csForEach } from "./csUtil.mjs";
import { TSClass } from "./definitions.mjs";

export default class UsageCollector {
    private readonly usedCls: Map<CS.CppAst.CppClass, TSClass> = new Map();
    constructor(private readonly compilation: CS.CppAst.CppCompilation) {
    }
    public findAstClass(clsFullName: string): CS.CppAst.CppClass | null {
        const classNamePart = clsFullName.split('::');
        let currentNamespace: CS.CppAst.CppCompilation | CS.CppAst.CppNamespace | CS.CppAst.CppClass = this.compilation;
        let result = null;

        while (classNamePart.length != 1) {
            const nsOrCls = classNamePart.shift();
            let ns: CS.CppAst.CppCompilation | CS.CppAst.CppNamespace | CS.CppAst.CppClass | null = null;
            if (currentNamespace.Namespaces) csForEach(currentNamespace.Namespaces, (item) => {
                if (item.Name == nsOrCls) ns = item;
            });
            if (!ns && currentNamespace.Classes) csForEach(currentNamespace.Classes, (cls) => {
                if (cls.Name == nsOrCls) ns = cls;
            });

            if (!ns) return null;
            currentNamespace = ns;
        }

        csForEach(currentNamespace.Classes, (cls) => {
            if (cls.FullName == clsFullName) result = cls;
        });
        return result;
    }
    public getAllUsedCls() {
        return this.usedCls.values();
    }
    public getAllHeaders() {
        const headers = [];
        for (const astCls of this.usedCls.keys()) {
            let header = astCls.SourceFile;
            // sometime the class will define as incomplete type. so we need to find the first member to get the real header path
            if (astCls.Fields.Count) { header = astCls.Fields.get_Item(0).SourceFile; }
            else if (astCls.Functions.Count) { header = astCls.Functions.get_Item(0).SourceFile; }
            else if (astCls.Constructors.Count) { header = astCls.Constructors.get_Item(0).SourceFile; }
            if (header) headers.push(header);
        }
        return headers;
    }

    protected addRefUsage(name: string) {
        if (name == "String") return;
        const astClass = this.findAstClass(name);

        if (!astClass) return;//console.warn(`can't find class ${clsName} in compilation`);;
        let tsCls;
        if (!this.usedCls.has(astClass)) {
            // console.log(astClass.FullName, DTSClass.isNotSupportedClass(astClass));
            if (TSClass.isNotSupportedClass(astClass)) return;
            tsCls = new TSClass(astClass)
            this.usedCls.set(astClass, tsCls);
            return tsCls

            // template not supported yet
            // if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateSpecializedClass) {
            //     csForEach(astClass.TemplateSpecializedArguments, item => {
            //         if (item.TypeKind == CS.CppAst.CppTypeKind.Function) return;
            //         this.addRefUsage(item.FullName);
            //     })
            // }
        }
    }
    public expandCurrentUsage() {
        for (const cls of this.usedCls.values()) {
            cls.baseTypeFullName && this.addRefUsage(cls.baseTypeFullName);
            cls.ctor.overloads.forEach((func) => {
                const type = func.returnType.rawType;
                if (!type.isPrimitive) this.addRefUsage(type.cppName)

                func.params.forEach((param) => {
                    const type = param.type.rawType;
                    if (!type.isPrimitive) this.addRefUsage(type.cppName)

                    if (param.astField.InitExpression && param.astField.InitExpression.Kind == CS.CppAst.CppExpressionKind.DeclRef) {
                        const dvCls = this.addRefUsage(param.astField.InitExpression.toString().split('::').slice(0, -1).join('::'));
                        if (dvCls) dvCls.addMember(param.astField.InitExpression.toString().split('::').slice(-1)[0]);
                    }
                })
            })
            cls.fields.forEach((field) => {
                const type = field.type.rawType;
                if (!type.isPrimitive) this.addRefUsage(type.cppName)
            })
            cls.functions.forEach((overload) => {
                overload.overloads.forEach((func) => {
                    const type = func.returnType.rawType;
                    if (!type.isPrimitive) this.addRefUsage(type.cppName)

                    func.params.forEach((param) => {
                        const type = param.type.rawType;
                        if (!type.isPrimitive) this.addRefUsage(type.cppName)

                        if (param.astField.InitExpression && param.astField.InitExpression.Kind == CS.CppAst.CppExpressionKind.DeclRef) {
                            const dvCls = this.addRefUsage(param.astField.InitExpression.toString().split('::').slice(0, -1).join('::'));
                            if (dvCls) dvCls.addMember(param.astField.InitExpression.toString().split('::').slice(-1)[0]);
                        }
                    })
                });
            });
        }

    }
    public addBaseUsage(signature: string) {
        const name = signature.split('::').slice(0, -1).join('::');
        if (name == 'String') return;
        const astClass = this.findAstClass(name);

        if (!astClass) return;//console.warn(`can't find class ${clsName} in compilation`);;
        if (!this.usedCls.has(astClass)) {
            if (TSClass.isNotSupportedClass(astClass)) return;
            this.usedCls.set(astClass, new TSClass(astClass));
        }
        const cls = this.usedCls.get(astClass) as TSClass;
        cls.addMember(signature);
    }
}