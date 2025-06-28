
import 'package:flutter/material.dart';

class MyDeferredWidget extends StatelessWidget {
  const MyDeferredWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('This is a deferred widget.'),
    );
  }
}
