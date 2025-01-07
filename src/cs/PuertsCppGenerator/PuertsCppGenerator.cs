// See https://aka.ms/new-console-template for more information
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Puerts;
using Puerts.Editor.Generator;
using System.Threading;
using System.Threading.Tasks;


class PuertsCppGenerator
{
    class JSLoader : ILoader, IResolvableLoader
    {
        private string currentDirectory;
        private string binaryDirectory;
        public JSLoader()
        {
            currentDirectory = Environment.CurrentDirectory;
            binaryDirectory = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
        }

        public string Resolve(string specifier, string referrer)
        {
            string filepath = specifier;
            if (PathHelper.IsRelative(specifier))
                filepath = PathHelper.normalize(PathHelper.Dirname(referrer) + "/" + specifier);
            
            if (filepath.StartsWith("lib") || filepath.StartsWith("puerts") || filepath.StartsWith("generator")) {
                if (System.IO.File.Exists(System.IO.Path.Combine(binaryDirectory, "../js", filepath)))
                    return filepath;
                else
                    return "";

            } else {
                if (System.IO.File.Exists(System.IO.Path.Combine(currentDirectory, filepath)))
                    return filepath;
                else
                    return "";
            }
        }

        public bool FileExists(string filepath)
        {
            return true;
        }

        public string ReadFile(string filepath, out string debugpath)
        {
            if (filepath.StartsWith("lib") || filepath.StartsWith("puerts") || filepath.StartsWith("generator")) {
                debugpath = System.IO.Path.Combine(binaryDirectory, "../js", filepath);
            } else {
                debugpath = System.IO.Path.Combine(currentDirectory, filepath);
            }
            return System.IO.File.ReadAllText(debugpath);
        }
    }

    [Configure]
    public static class CppAstDelaration
    {
        private static void AddAllBaseTypeToList(Type t, List<Type> res)
        {
            while (t != typeof(System.Object))
            {
                res.Add(t);
                t = t.BaseType;
            }
        }

        [Typing]
        public static List<Type> TypingList
        {
            get
            {
                var res = new List<Type>();
                res.Add(typeof(System.Console));
                res.Add(typeof(System.IO.Path));
                res.Add(typeof(System.IO.File));
                res.Add(typeof(CppAst.CppContainerList<CppAst.CppClass>));
                res.Add(typeof(System.Collections.Generic.List<CppAst.CppClass>));
                AddAllBaseTypeToList(typeof(CppAst.CppTypeWithElementType), res);
                AddAllBaseTypeToList(typeof(CppAst.CppExtensions), res);
                AddAllBaseTypeToList(typeof(CppAst.CppTemplateArgument), res);
                AddAllBaseTypeToList(typeof(CppAst.CppFunctionType), res);
                AddAllBaseTypeToList(typeof(CppAst.CppExpression), res);
                AddAllBaseTypeToList(typeof(CppAst.CppRawExpression), res);
                AddAllBaseTypeToList(typeof(CppAst.CppCompilation), res);
                AddAllBaseTypeToList(typeof(CppAst.CppClass), res);
                AddAllBaseTypeToList(typeof(CppAst.CppFunction), res);
                AddAllBaseTypeToList(typeof(CppAst.CppField), res);
                AddAllBaseTypeToList(typeof(CppAst.CppEnum), res);
                AddAllBaseTypeToList(typeof(CppAst.CppEnumItem), res);
                AddAllBaseTypeToList(typeof(CppAst.CppNamespace), res);
                AddAllBaseTypeToList(typeof(CppAst.CppBaseType), res);
                AddAllBaseTypeToList(typeof(CppAst.CppParameter), res);
                AddAllBaseTypeToList(typeof(CppAst.CppAttribute), res);
                return res;
            }
        }

    }   

    static void Run(string configFileName)
    {
        var loader = new JSLoader();

        var jsEnv = new JsEnv(loader);
        
        JSObject BindingConfig = jsEnv.ExecuteModule(configFileName).Get<JSObject>("default");
        string basePath = BindingConfig.Get<string>("base");
        Action<CppAst.CppCompilation, JSObject> doGenerate 
            = jsEnv.ExecuteModule("generator.mjs").Get<
                Action<CppAst.CppCompilation, JSObject>
            >("default");
        
        var config = new CppAst.CppParserOptions();
        config.AdditionalArguments.Add("-std=c++17");
        
        JSObject includePaths = BindingConfig.Get<JSObject>("includePaths");
        int includePathsCount = includePaths.Get<int>("length");
        for (int i = 0; i < includePathsCount; i++)
        {
            config.IncludeFolders.Add(includePaths.Get<string>("" + i));
        }
        JSObject defines = BindingConfig.Get<JSObject>("defines");
        int definesCount = defines.Get<int>("length");
        for (int i = 0; i < definesCount; i++)
        {
            config.Defines.Add(defines.Get<string>("" + i));
        }
        config.Defines.Add("PUER_BINDING_GENERATING");
        
        JSObject headers = BindingConfig.Get<JSObject>("headers");
        int headersCount = headers.Get<int>("length");
        List<string> headerPaths = new();
        for (int i = 0; i < headersCount; i++)
        {
            string headerPath = headers.Get<string>("" + i);
            headerPaths.Add(headerPath);
        }
        var compilation = CppAst.CppParser.ParseFiles(headerPaths, config);
        if (compilation.HasErrors)
        {
            System.Console.WriteLine(compilation.Diagnostics);
        }

        var BindingConfigOutput = BindingConfig.Get<JSObject>("output");
        string bindingOutputPath = "";
        string dtsOutputPath = "";
        string patchJSOutputPath = "";
        if (BindingConfigOutput != null) 
        {
            bindingOutputPath = BindingConfigOutput.Get<string>("binding");
            dtsOutputPath = BindingConfigOutput.Get<string>("dts");
            patchJSOutputPath = BindingConfigOutput.Get<string>("patchjs");
            System.IO.Directory.CreateDirectory(Path.GetDirectoryName(bindingOutputPath));
            System.IO.Directory.CreateDirectory(Path.GetDirectoryName(dtsOutputPath));
            System.IO.Directory.CreateDirectory(Path.GetDirectoryName(patchJSOutputPath));
        }

        doGenerate(
            compilation, 
            BindingConfig
        );
    }

    static int Main(string[] args)
    {
        Thread thread = new Thread(delegate()
        {
            string configFileName = args.Length >= 2 && args[0] == "-c" ? args[1] : "binding.config.js";
            Run(configFileName);
        }, 16 * 1024 * 1024);
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        return 0;
    }
}