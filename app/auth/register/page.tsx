import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata = {
  title: 'Create an Account | The Corporate Blog',
  description: 'Create a new account for The Corporate Blog.',
};

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Create your account</h1>
            <p className="mt-3 text-gray-600">
              Account registration is not enabled yet in this build. If you already have an
              account, you can sign in. Otherwise, check back soon.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="btn-primary text-center"
              >
                Sign in
              </Link>
              <Link
                href="/newsletter"
                className="btn-secondary text-center"
              >
                Subscribe to newsletter
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
