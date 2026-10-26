const cart = new Map();
const menuToggle = document.querySelector('#menuToggle');
const nav = document.querySelector('#nav');
const orderDialog = document.querySelector('#orderDialog');
const orderSummary = document.querySelector('#orderSummary');
const checkout = document.querySelector('#checkout');
const walletButton = document.querySelector('#walletButton');
const walletLabel = document.querySelector('#walletLabel');
const tokenBalance = document.querySelector('#tokenBalance');
const transactionStoreKey = 'kopiSoreDemoTransactions';
let currentOrderTotal = 0;
let transactions = [];
try {
  transactions = JSON.parse(localStorage.getItem(transactionStoreKey) || '[]');
} catch {
  transactions = [];
}

menuToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Tutup navigasi' : 'Buka navigasi');
});

nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

document.querySelectorAll('.add-order').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.item;
    const price = Number(button.dataset.price);
    cart.set(name, (cart.get(name) || 0) + 1);
    const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
    orderSummary.textContent = `${count} item dalam pesanan`;
    checkout.disabled = false;
    button.innerHTML = 'Ditambahkan <span>✓</span>';
    window.setTimeout(() => { button.innerHTML = 'Tambah ke pesanan <span>+</span>'; }, 1100);
    button.dataset.lastPrice = String(price);
  });
});

function rupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

checkout.addEventListener('click', () => {
  const orderList = document.querySelector('#orderList');
  const rows = [...cart.entries()];
  currentOrderTotal = rows.reduce((sum, [name, quantity]) => {
    const price = Number(document.querySelector(`[data-item="${CSS.escape(name)}"]`).dataset.price);
    return sum + price * quantity;
  }, 0);
  orderList.innerHTML = rows.map(([name, quantity]) => {
    const price = Number(document.querySelector(`[data-item="${CSS.escape(name)}"]`).dataset.price);
    return `<div class="order-row"><span>${quantity} × ${name}</span><strong>${rupiah(price * quantity)}</strong></div>`;
  }).join('');
  document.querySelector('#orderTotal').textContent = rupiah(currentOrderTotal);
  const message = rows.map(([name, quantity]) => `${quantity}x ${name}`).join(', ');
  document.querySelector('#whatsappOrder').href = `https://wa.me/?text=${encodeURIComponent(`Halo Kopi Sore Ambon, saya ingin pesan: ${message}. Total ${rupiah(currentOrderTotal)}.`)}`;
  document.querySelector('#paymentSuccess').hidden = true;
  orderDialog.showModal();
});

document.querySelector('#closeDialog').addEventListener('click', () => orderDialog.close());
orderDialog.addEventListener('click', (event) => {
  if (event.target === orderDialog) orderDialog.close();
});

function renderTransactions() {
  const list = document.querySelector('#txList');
  const empty = document.querySelector('#txEmpty');
  document.querySelector('#clearTransactions').disabled = transactions.length === 0;
  empty.hidden = transactions.length > 0;
  list.replaceChildren();
  transactions.slice(0, 5).forEach((transaction) => {
    const row = document.createElement('div');
    row.className = 'tx-row';
    const details = document.createElement('span');
    details.textContent = `${transaction.method} · ${transaction.time}`;
    const id = document.createElement('small');
    id.className = 'tx-id';
    id.textContent = transaction.id;
    details.append(id);
    const amount = document.createElement('strong');
    amount.className = 'tx-amount';
    amount.textContent = rupiah(transaction.amount);
    const status = document.createElement('span');
    status.className = 'tx-status';
    status.textContent = 'DEMO OK';
    row.append(details, amount, status);
    list.append(row);
  });
}

renderTransactions();
document.querySelector('#clearTransactions').addEventListener('click', () => {
  if (!transactions.length || !window.confirm('Hapus semua riwayat pembayaran demo di browser ini?')) return;
  transactions = [];
  try {
    localStorage.removeItem(transactionStoreKey);
  } catch {
    // The visible session history is still cleared.
  }
  renderTransactions();
});

document.querySelector('#simulatePayment').addEventListener('click', () => {
  const method = document.querySelector('input[name="paymentMethod"]:checked').value;
  const transaction = {
    id: `KS-${Date.now().toString().slice(-8)}`,
    method,
    amount: currentOrderTotal,
    time: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
  };
  transactions = [transaction, ...transactions].slice(0, 10);
  try {
    localStorage.setItem(transactionStoreKey, JSON.stringify(transactions));
  } catch {
    // The current page session still keeps this demo transaction in memory.
  }
  renderTransactions();
  const success = document.querySelector('#paymentSuccess');
  success.textContent = `Transaksi demo ${transaction.id} tercatat: ${rupiah(transaction.amount)} via ${method}. Tidak ada dana yang dipindahkan.`;
  success.hidden = false;
});

async function connectWallet() {
  if (!window.ethereum) {
    walletLabel.textContent = 'Install MetaMask';
    window.setTimeout(() => { walletLabel.textContent = 'Connect Wallet'; }, 2400);
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts.length) return;
    walletLabel.textContent = `${accounts[0].slice(0, 6)}…${accounts[0].slice(-4)}`;
    tokenBalance.innerHTML = '0 <small>$SORE · demo</small>';
    walletButton.classList.add('connected');
  } catch (error) {
    walletLabel.textContent = error.code === 4001 ? 'Connection rejected' : 'Try again';
    window.setTimeout(() => { walletLabel.textContent = 'Connect Wallet'; }, 2400);
  }
}

walletButton.addEventListener('click', connectWallet);
if (window.ethereum?.on) {
  window.ethereum.on('accountsChanged', (accounts) => {
    if (!accounts.length) {
      walletLabel.textContent = 'Connect Wallet';
      tokenBalance.textContent = '— $SORE';
      walletButton.classList.remove('connected');
      return;
    }
    walletLabel.textContent = `${accounts[0].slice(0, 6)}…${accounts[0].slice(-4)}`;
    tokenBalance.innerHTML = '0 <small>$SORE · demo</small>';
  });
}

document.querySelector('#shareSite').addEventListener('click', async () => {
  const shareData = { title: 'Kopi Sore Web3', text: 'Kopi Sore — coffee & Web3 community', url: window.location.href };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      document.querySelector('#shareSite').textContent = 'Link tersalin ✓';
    } else {
      window.prompt('Salin link website ini:', window.location.href);
    }
  } catch (error) {
    if (error.name !== 'AbortError') window.prompt('Salin link website ini:', window.location.href);
  }
});

let demoVotes = { 'Matcha Cloud': 42, 'Orange Espresso': 58 };
document.querySelectorAll('.vote-option').forEach((button) => {
  button.addEventListener('click', () => {
    demoVotes[button.dataset.vote] += 1;
    const total = Object.values(demoVotes).reduce((sum, votes) => sum + votes, 0);
    document.querySelectorAll('.vote-option').forEach((option) => {
      option.classList.toggle('selected', option === button);
      const percent = Math.round((demoVotes[option.dataset.vote] / total) * 100);
      option.querySelector('.vote-count').textContent = `${percent}%`;
    });
    document.querySelector('#voteMessage').textContent = `Pilihan ${button.dataset.vote} tersimpan di halaman ini · belum on-chain`;
  });
});
