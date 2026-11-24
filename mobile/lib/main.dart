import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

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
      );
    _configureAndroidFileSelector();
    controller.loadRequest(Uri.parse(apiBase));
  }

  Future<void> _configureAndroidFileSelector() async {
    if (!Platform.isAndroid) return;
    try {
      final androidController = controller.platform as AndroidWebViewController;
      await androidController.setOnShowFileSelector(_onShowFileSelector);
    } catch (_) {
      // File selection is best-effort on Android WebView.
    }
  }

  Future<List<String>> _onShowFileSelector(FileSelectorParams params) async {
    final allowMultiple = params.mode == FileSelectorMode.openMultiple;
    final wantsImage = params.acceptTypes.whereType<String>().any((type) => type.contains('image'));
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: allowMultiple,
      type: wantsImage ? FileType.image : FileType.any,
    );
    return result?.files.map((file) => file.path).whereType<String>().toList() ?? [];
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (await controller.canGoBack()) {
          await controller.goBack();
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('PICKAPP')),
        body: Stack(
          children: [
            WebViewWidget(controller: controller),
            if (loading) const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}
