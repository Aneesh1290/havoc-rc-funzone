import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";
import { CartSidebar } from "@/components/CartSidebar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen w-full overflow-x-clip">
        <Header />
        <main className="flex-grow flex flex-col min-w-0 w-full overflow-x-clip">
          {children}
        </main>
        <Footer />
        <CartSidebar />
      </div>
    </CartProvider>
  );
}
