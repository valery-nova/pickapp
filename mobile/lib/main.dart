import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String apiBase = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://gone-except-devices-chapters.trycloudflare.com',
);

void main() {
  runApp(const PickApp());
}

class PickApp extends StatelessWidget {
  const PickApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PICKAPP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE11D48)),
        useMaterial3: true,
      ),
      home: const PickAppWebView(),
    );
  }
}

class PickAppWebView extends StatefulWidget {
  const PickAppWebView({super.key});

  @override
  State<PickAppWebView> createState() => _PickAppWebViewState();
}

class _PickAppWebViewState extends State<PickAppWebView> {
  late final WebViewController controller;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) => NavigationDecision.navigate,
          onPageStarted: (_) => setState(() => loading = true),
          onPageFinished: (_) => setState(() => loading = false),
        ),
      )
      ..loadRequest(Uri.parse(apiBase));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('PICKAPP')),
      body: Stack(
        children: [
          WebViewWidget(controller: controller),
          if (loading)
            const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
