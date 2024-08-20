import Document, { Html, Head, Main, NextScript, DocumentContext } from "next/document";
import crypto from 'crypto';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    const nonce = crypto.randomBytes(16).toString('base64');
    return { ...initialProps, nonce };
  }

  render() {
    const { nonce } = this.props as { nonce: string };
    return (
      <Html lang="en" className="h-full bg-slate-50">
        <Head nonce={nonce} />
        <body className="h-full">
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}

export default MyDocument;

