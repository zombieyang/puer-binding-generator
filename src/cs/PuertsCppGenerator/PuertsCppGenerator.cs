// See https://aka.ms/new-console-template for more information
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Puerts;
using Puerts.Editor.Generator;
using System.Threading;
using System.Threading.Tasks;


public class PuertsCppGenerator
{
    class JSLoader : ILoader, IResolvableLoader
    {
        private string workingDirectory;
        private string jsDirectory;
        public JSLoader(string workingDir, string jsDir)
        {
            workingDirectory = workingDir;
            jsDirectory = string.IsNullOrEmpty(jsDir) ? 
                Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location) : 
                jsDir;
        }

        public string Resolve(string specifier, string referrer)
        {
            string filepath = specifier;
            if (PathHelper.IsRelative(specifier))
                filepath = PathHelper.normalize(PathHelper.Dirname(referrer) + "/" + specifier);
            
            if (filepath.StartsWith("lib") || filepath.StartsWith("puerts") || filepath.StartsWith("generator")) {
                if (System.IO.File.Exists(System.IO.Path.Combine(jsDirectory, "../js", filepath)))
                    return filepath;
                else
                    return "";

            } else {
                if (System.IO.File.Exists(System.IO.Path.Combine(workingDirectory, filepath)))
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
                debugpath = System.IO.Path.Combine(jsDirectory, "../js", filepath);
            } else {
                debugpath = System.IO.Path.Combine(workingDirectory, filepath);
            }
            return System.IO.File.ReadAllText(debugpath);
        }
    }

    public static void Run(string configFileName, string workingDir, string jsDir = null)
    {
        var loader = new JSLoader(workingDir, jsDir);

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
            string workingDir = Environment.CurrentDirectory;
            string configFileName = args.Length >= 2 && args[0] == "-c" ? args[1] : "binding.config.js";
            Run(configFileName, workingDir);
        }, 16 * 1024 * 1024);
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        return 0;
    }
}