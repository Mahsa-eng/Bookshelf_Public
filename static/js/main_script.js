// main_script.js – Bookshelf

// Sidebar toggle logic 
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
menuBtn.onclick = () => {
  sidebar.classList.toggle('open');
};
document.addEventListener('click', (e) => {
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
    sidebar.classList.remove('open');
  }
});

// Category filtering logic
const shelfCategories = document.querySelectorAll('.shelf-categories li');
shelfCategories.forEach(li => {
  li.onclick = () => {
    shelfCategories.forEach(item => item.classList.remove('active'));
    li.classList.add('active');
    const cat = li.textContent.trim();
    document.querySelectorAll('.shelf').forEach(shelf => {
      const shelfCat = shelf.getAttribute('data-category');
      shelf.style.display = (cat === 'All' || shelfCat === cat) ? 'flex' : 'none';
    });
  };
});

// Live search logic
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    document.querySelectorAll('.book').forEach(book => {
      const img = book.querySelector('img');
      const title = img?.getAttribute('alt')?.toLowerCase() || '';
      book.style.display = title.includes(query) ? '' : 'none';
    });
    // Hide shelves with no visible books
    document.querySelectorAll('.shelf').forEach(shelf => {
      const visibleBooks = shelf.querySelectorAll('.book:not([style*="display: none"])').length;
      shelf.style.display = visibleBooks ? 'flex' : 'none';
    });
  });
}

// Modal logic (open/close and favorite toggle)
document.addEventListener("click", (e) => {
  if (e.target.matches(".btn-tale")) {
    const modal = document.getElementById("bookModal1");
    if (modal) modal.style.display = "block";
  }
  if (
    e.target.matches(".close") ||
    (e.target.matches(".modal") && !e.target.querySelector(".modal-content"))
  ) {
    const modal = e.target.closest(".modal");
    if (modal) modal.style.display = "none";
  }
  if (e.target.matches("[data-fav]")) {
    e.target.classList.toggle("active");
  }
});

// Sidebar footer button actions
document.querySelectorAll('.sidebar-footer button').forEach(btn => {
  if (btn.classList.contains('night-btn')) {
    btn.addEventListener('click', function(e) {
      document.body.classList.toggle('dark-theme');
      this.classList.toggle('active');
      const span = this.querySelector('span');
      if (span) span.textContent = document.body.classList.contains('dark-theme') ? 'Light' : 'Night';
      e.stopPropagation();
    });
    return;
  }
  btn.addEventListener('click', (e) => {
    const text = btn.textContent.trim();
    if (text.includes('Options')) {
      showModal('optionsModal');
    }
    else if (text.includes('About')) {
      showModal('aboutModal');
    }
    else if (text.includes('Exit')) {
      alert('To exit, simply close the tab.');
    }
    e.stopPropagation();
  });
});

function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'block';
}
document.querySelectorAll('.modal .close').forEach(cl => {
  cl.onclick = () => cl.closest('.modal').style.display = 'none';
});

// ===== New: Fetch and Render Books (max 6 per shelf) =====
async function fetchAndRenderBooks() {
  try {
    const response = await fetch('/api/books');
    if (!response.ok) throw new Error('Failed to fetch books');
    const booksData = await response.json();
    window.booksData = booksData;
    // Group books by category
    const booksByCategory = {};
    booksData.forEach(book => {
      const cat = book.category || 'Uncategorized';
      if (!booksByCategory[cat]) booksByCategory[cat] = [];
      booksByCategory[cat].push(book);
    });

    // Get container element
    const container = document.getElementById('booksContainer');
    container.innerHTML = ''; // Clear previous content

    // Create shelves in chunks of max 6 books
    Object.keys(booksByCategory).forEach(category => {
      const booksList = booksByCategory[category];
      for (let i = 0; i < booksList.length; i += 6) {
        const chunk = booksList.slice(i, i + 6);
        const shelfDiv = document.createElement('div');
        shelfDiv.classList.add('shelf');
        shelfDiv.setAttribute('data-category', category);

        chunk.forEach(book => {
          // Create book element
          const bookDiv = document.createElement('div');
          bookDiv.classList.add('book');

          // Shadow
          const shadowSpan = document.createElement('span');
          shadowSpan.classList.add('shadow');
          bookDiv.appendChild(shadowSpan);

          // Back
          const backDiv = document.createElement('div');
          backDiv.classList.add('back');
          bookDiv.appendChild(backDiv);

          // Cover end
          const coverEndDiv = document.createElement('div');
          coverEndDiv.classList.add('cover-end');
          bookDiv.appendChild(coverEndDiv);

          // Page divs
          ['first', 'second', 'third', 'last'].forEach(cls => {
            const pageDiv = document.createElement('div');
            pageDiv.classList.add('page', cls);
            if (cls === 'last') {
              const btn = document.createElement('button');
              btn.classList.add('btn-tale');
              btn.textContent = 'View details';
              btn.setAttribute('data-id', book.id);
              btn.onclick = () => {
                openBookModal(book.id);
              };

              pageDiv.appendChild(btn);
            }
            bookDiv.appendChild(pageDiv);
          });

          // Cover
          const coverDiv = document.createElement('div');
          coverDiv.classList.add('cover');
          const img = document.createElement('img');
          img.src = `/static/${book.cover}`; // e.g. /static/covers/cover.jpg
          img.alt = book.title;
          coverDiv.appendChild(img);
          bookDiv.appendChild(coverDiv);

          // Append book to shelf
          shelfDiv.appendChild(bookDiv);
        });

        // Append shelf to container
        container.appendChild(shelfDiv);
      }
    });

  } catch (err) {
    console.error('Error fetching or rendering books:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchAndRenderBooks();
});

function openBookModal(bookId) {
  // Find the correct book object from booksData array (store it globally)
  const book = window.booksData.find(b => b.id === bookId);
  if (!book) return;

  // Set modal fields
  document.getElementById('modalCover').src = `/static/${book.cover}`;
  document.getElementById('inputTitle').value = book.title;
  document.getElementById('inputAuthors').value = book.authors || '';
  document.getElementById('inputDesc').value = book.desc || '';
  document.getElementById('selectCategory').value = book.category;

  // Store current bookId for saving later
  document.getElementById('saveChangesBtn').setAttribute('data-id', bookId);

  // Show modal
  document.getElementById('bookModal1').style.display = 'block';
}

const editForm = document.getElementById('editForm');
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bookId = document.getElementById('saveChangesBtn').getAttribute('data-id');
  const payload = {
    id: bookId,
    title: document.getElementById('inputTitle').value,
    authors: document.getElementById('inputAuthors').value,
    desc: document.getElementById('inputDesc').value,
    category: document.getElementById('selectCategory').value
  };
  const res = await fetch('/api/edit_book', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  console.log(result);
  alert(result.message);
  document.getElementById('bookModal1').style.display = 'none';
  fetchAndRenderBooks();
});

// Open Add Book Modal
const addBookBtn = document.getElementById('addBookBtn');
const addBookModal = document.getElementById('addBookModal');
if (addBookBtn) {
  addBookBtn.addEventListener('click', () => {
    addBookModal.style.display = 'block';
  });
}

// Handle Add Book Form submission
const addBookForm = document.getElementById('addBookForm');
if (addBookForm) {
  addBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addBookForm);
    const res = await fetch('/api/upload_book', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    alert(result.message);
    if (result.status === 'success') {
      addBookModal.style.display = 'none';
      fetchAndRenderBooks(); // refresh list
    }
  });
}

// Close Add Book Modal when clicking outside or on close button
document.addEventListener('click', (e) => {
  if (e.target.matches('#addBookModal .close') || (e.target.matches('.modal') && e.target.id === 'addBookModal')) {
    addBookModal.style.display = 'none';
  }
});
