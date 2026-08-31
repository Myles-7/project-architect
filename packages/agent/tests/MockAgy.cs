using System;
using System.Threading;

class MockAgy {
    static void Main(string[] args) {
        if (args.Length < 2 || args[0] != "-p") {
            Console.Error.WriteLine("Mock agy requires prompt to be passed with -p.");
            Environment.Exit(2);
            return;
        }

        string mode = Environment.GetEnvironmentVariable("MOCK_AGY_MODE") ?? "default";
        if (mode == "hang") {
            Thread.Sleep(60000);
            return;
        }
        if (mode == "flood") {
            string chunk = new string('A', 4096);
            while (true) {
                Console.Write(chunk);
                Thread.Sleep(5);
            }
        }
        if (mode == "invalid_json") {
            Console.WriteLine("<!DOCTYPE html><html>502 Bad Gateway</html>");
            return;
        }
        Console.WriteLine("{\"structured_output\":{\"confirmed\":[\"No Shell Injection\"],\"candidates\":[\"Safe Exec\"],\"assumptions\":[],\"unknowns\":[],\"risks\":[],\"conflicts\":[],\"tensions\":[],\"gaps\":[],\"questions\":[]},\"usage\":{\"input_tokens\":10,\"output_tokens\":20}}");
    }
}
