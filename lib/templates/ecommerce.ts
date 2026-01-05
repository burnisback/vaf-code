/**
 * E-commerce Template
 * E-commerce with product grid and cart placeholder
 */

import { FileSystemTree } from '@webcontainer/api';

export const ecommerceTemplate: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'ecommerce-store',
        version: '1.0.0',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview'
        },
        devDependencies: {
          vite: '^5.0.0'
        }
      }, null, 2)
    }
  },
  'index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>E-commerce Store</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <!-- Header -->
    <header class="header">
      <div class="container">
        <div class="logo">🛍️ Shop</div>
        <nav class="nav">
          <a href="#">Products</a>
          <a href="#">Categories</a>
          <a href="#">About</a>
        </nav>
        <div class="cart-icon">
          🛒
          <span class="cart-count">0</span>
        </div>
      </div>
    </header>

    <!-- Hero Banner -->
    <section class="hero">
      <div class="container">
        <h1>Summer Sale</h1>
        <p>Up to 50% off on selected items</p>
        <button class="btn btn-primary">Shop Now</button>
      </div>
    </section>

    <!-- Products Grid -->
    <section class="products">
      <div class="container">
        <h2>Featured Products</h2>
        <div class="products-grid" id="products-grid">
          <!-- Products will be inserted here by JS -->
        </div>
      </div>
    </section>

    <!-- Cart Sidebar -->
    <aside class="cart-sidebar" id="cart-sidebar">
      <div class="cart-header">
        <h3>Shopping Cart</h3>
        <button class="close-cart">✕</button>
      </div>
      <div class="cart-items" id="cart-items">
        <div class="cart-empty">Your cart is empty</div>
      </div>
      <div class="cart-footer">
        <div class="cart-total">
          <span>Total:</span>
          <span id="cart-total">$0.00</span>
        </div>
        <button class="btn btn-primary btn-block">Checkout</button>
      </div>
    </aside>

    <script type="module" src="/main.js"></script>
  </body>
</html>`
    }
  },
  'style.css': {
    file: {
      contents: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Header */
.header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
}

.nav {
  display: flex;
  gap: 2rem;
}

.nav a {
  color: #333;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.nav a:hover {
  color: #667eea;
}

.cart-icon {
  position: relative;
  font-size: 1.5rem;
  cursor: pointer;
}

.cart-count {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

/* Hero */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 0;
  text-align: center;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.btn {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-block {
  width: 100%;
}

/* Products */
.products {
  padding: 4rem 0;
}

.products h2 {
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 2rem;
}

.product-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
}

.product-card:hover {
  transform: translateY(-5px);
}

.product-image {
  width: 100%;
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

.product-info {
  padding: 1.5rem;
}

.product-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.product-price {
  font-size: 1.5rem;
  color: #667eea;
  font-weight: 700;
  margin-bottom: 1rem;
}

.add-to-cart {
  width: 100%;
  background: #667eea;
  color: white;
}

.add-to-cart:hover {
  background: #5568d3;
}

/* Cart Sidebar */
.cart-sidebar {
  position: fixed;
  right: -400px;
  top: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: right 0.3s;
  z-index: 1000;
}

.cart-sidebar.open {
  right: 0;
}

.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.close-cart {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.cart-empty {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.cart-item {
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.cart-item-info {
  flex: 1;
}

.cart-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.cart-total {
  display: flex;
  justify-content: space-between;
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
}`
    }
  },
  'main.js': {
    file: {
      contents: `// Sample products
const products = [
  { id: 1, name: 'Premium Headphones', price: 99.99, emoji: '🎧' },
  { id: 2, name: 'Wireless Mouse', price: 29.99, emoji: '🖱️' },
  { id: 3, name: 'Mechanical Keyboard', price: 149.99, emoji: '⌨️' },
  { id: 4, name: 'USB-C Hub', price: 49.99, emoji: '🔌' },
  { id: 5, name: 'Laptop Stand', price: 39.99, emoji: '💻' },
  { id: 6, name: 'Phone Case', price: 19.99, emoji: '📱' },
];

let cart = [];

// Render products
const productsGrid = document.getElementById('products-grid');
products.forEach(product => {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = \`
    <div class="product-image">\${product.emoji}</div>
    <div class="product-info">
      <div class="product-name">\${product.name}</div>
      <div class="product-price">$\${product.price}</div>
      <button class="btn add-to-cart" data-id="\${product.id}">Add to Cart</button>
    </div>
  \`;
  productsGrid.appendChild(card);
});

// Cart functionality
const cartSidebar = document.getElementById('cart-sidebar');
const cartIcon = document.querySelector('.cart-icon');
const closeCart = document.querySelector('.close-cart');
const cartCount = document.querySelector('.cart-count');

cartIcon.addEventListener('click', () => {
  cartSidebar.classList.add('open');
});

closeCart.addEventListener('click', () => {
  cartSidebar.classList.remove('open');
});

// Add to cart
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('add-to-cart')) {
    const productId = parseInt(e.target.dataset.id);
    const product = products.find(p => p.id === productId);
    cart.push(product);
    updateCart();
  }
});

function updateCart() {
  cartCount.textContent = cart.length;
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');

  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
    cartTotal.textContent = '$0.00';
    return;
  }

  cartItems.innerHTML = cart.map(item => \`
    <div class="cart-item">
      <div>\${item.emoji}</div>
      <div class="cart-item-info">
        <div>\${item.name}</div>
        <div>$\${item.price}</div>
      </div>
    </div>
  \`).join('');

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  cartTotal.textContent = \`$\${total.toFixed(2)}\`;
}

console.log('E-commerce store initialized!');
`
    }
  },
  'vite.config.js': {
    file: {
      contents: `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
});`
    }
  }
};
