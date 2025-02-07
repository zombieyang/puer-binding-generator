using System;// See https://aka.ms/new-console-template for more information
using System.Collections.Generic;
using System.IO;
using Puerts;
using Puerts.Editor.Generator;

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
            if (System.IO.File.Exists(System.IO.Path.Combine(currentDirectory, "../../../../../../js", filepath)))
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
            debugpath = System.IO.Path.Combine(currentDirectory, "../../../../../../js", filepath);
        } else {
            debugpath = System.IO.Path.Combine(currentDirectory, filepath);
        }
        return System.IO.File.ReadAllText(debugpath);
    }
}
class Program
{
    static int Main(string[] args)
    {
        var jsloader = new JSLoader();

        System.Console.WriteLine("Exporting DTS");
        Directory.CreateDirectory(Path.Combine(Environment.CurrentDirectory, "../../../../../../js/dts/Typing/csharp"));
        FileExporter.ExportDTS(Path.Combine(Environment.CurrentDirectory, "../../../../../../js/dts/"), jsloader);

        System.Console.WriteLine("Run Test Generation");
        PuertsCppGenerator.Run(
            "binding.config.js", 
            Path.Combine(Environment.CurrentDirectory, "../../../../../../../sample/"),
            Path.Combine(Environment.CurrentDirectory, "../../../../../../../dist/js/")
        );

        return 0;


//         // 创建一个简单的测试头文件
//         string testHeader = @"
// #pragma once

// enum class TestEnum {
//     Value1,
//     Value2,
//     Value3
// };

// class TestClass {
// public:
//     void TestMethod();
//     int TestProperty;
// };
// ";
//         string headerPath = "test.h";
//         System.IO.File.WriteAllText(headerPath, testHeader);

//         // 调用 PuertsCppGenerator
//         string[] generatorArgs = new string[] { "-c", "test.config.js" };
//         return PuertsCppGenerator.Main(generatorArgs);
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
