<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { api, clearSession, saveSession, session, sessionNotice } from './api.js'

const signedIn = computed(() => Boolean(session.value?.access_token))
const username = computed(() => session.value?.user?.username || 'user')
const login = reactive({ username: '', password: '' })
const products = ref([])
const loading = ref(false)
const busy = ref(false)
const starting = ref(true)
const error = ref('')
const notice = ref('')
const mode = ref('list')
const editingId = ref(null)
const fields = reactive({ product_name: '', description: '', price: '', quantity: '' })
const fieldErrors = ref({})
const deleteTarget = ref(null)
const deleteDialog = ref(null)
const deleteError = ref('')
const nameInput = ref(null)
const loginInput = ref(null)
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

watch(signedIn, async (value) => {
  if (!value) {
    products.value = []
    mode.value = 'list'
    editingId.value = null
    deleteDialog.value?.close()
    deleteTarget.value = null
    notice.value = ''
    error.value = ''
    login.password = ''
    await nextTick()
    loginInput.value?.focus()
  }
})

async function loadProducts() {
  loading.value = true
  error.value = ''
  try {
    const response = await api('/products')
    if (!Array.isArray(response.data)) throw new Error('The product list could not be loaded.')
    products.value = response.data
  } catch (failure) {
    error.value = failure.message
  } finally {
    loading.value = false
  }
}

async function signIn() {
  busy.value = true
  error.value = ''
  sessionNotice.value = ''
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { username: login.username.trim(), password: login.password },
      authenticated: false,
    })
    saveSession(data)
    login.password = ''
    await loadProducts()
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}

async function signOut() {
  busy.value = true
  let message = 'You have been logged out.'
  try {
    await api('/auth/logout', {
      method: 'POST',
      body: { refresh_token: session.value?.refresh_token },
      refresh: false,
    })
  } catch {
    message = 'You are logged out of this browser. The server could not confirm session revocation.'
  } finally {
    clearSession(message)
    busy.value = false
  }
}

async function openForm(product = null) {
  editingId.value = product?.id ?? null
  Object.assign(fields, {
    product_name: product?.product_name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    quantity: product?.quantity ?? '',
  })
  fieldErrors.value = {}
  error.value = ''
  notice.value = ''
  mode.value = 'form'
  await nextTick()
  nameInput.value?.focus()
}

function cancelForm() {
  mode.value = 'list'
  error.value = ''
  fieldErrors.value = {}
}

function validate() {
  const errors = {}
  if (!fields.product_name.trim()) errors.product_name = 'Enter a product name.'
  if (!fields.description.trim()) errors.description = 'Enter a description.'
  if (fields.price === '' || !Number.isFinite(Number(fields.price)) || Number(fields.price) < 0 || Number(fields.price) > 99999999.99) {
    errors.price = 'Enter a price from 0 to 99,999,999.99.'
  } else if (Math.abs(Number(fields.price) * 100 - Math.round(Number(fields.price) * 100)) > 0.00001) {
    errors.price = 'Use no more than two decimal places.'
  }
  if (fields.quantity === '' || !Number.isSafeInteger(Number(fields.quantity)) || Number(fields.quantity) < 0 || Number(fields.quantity) > 2147483647) {
    errors.quantity = 'Enter a whole quantity from 0 to 2,147,483,647.'
  }
  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function saveProduct() {
  error.value = ''
  if (!validate()) return
  busy.value = true
  try {
    const editing = editingId.value !== null
    const response = await api(editing ? `/products/${editingId.value}` : '/products', {
      method: editing ? 'PUT' : 'POST',
      body: {
        product_name: fields.product_name.trim(),
        description: fields.description.trim(),
        price: Number(fields.price),
        quantity: Number(fields.quantity),
      },
    })
    notice.value = response.message || (editing ? 'Product updated.' : 'Product added.')
    mode.value = 'list'
    await loadProducts()
  } catch (failure) {
    error.value = failure.message
    fieldErrors.value = failure.errors || {}
  } finally {
    busy.value = false
  }
}

async function confirmDelete(product) {
  deleteTarget.value = product
  deleteError.value = ''
  await nextTick()
  deleteDialog.value.showModal()
}

function cancelDelete() {
  if (busy.value) return
  deleteDialog.value.close()
  deleteTarget.value = null
  deleteError.value = ''
}

async function deleteProduct() {
  if (!deleteTarget.value || busy.value) return
  busy.value = true
  deleteError.value = ''
  try {
    const response = await api(`/products/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteDialog.value.close()
    deleteTarget.value = null
    notice.value = response.message || 'Product deleted.'
    await loadProducts()
  } catch (failure) {
    deleteError.value = failure.message
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  if (signedIn.value) {
    try {
      const response = await api('/auth/me')
      saveSession({ ...session.value, user: response.user })
      await loadProducts()
    } catch (failure) {
      error.value = failure.message
    }
  }
  starting.value = false
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <span class="brand">Activity 6</span>
      <div v-if="signedIn" class="account">
        <span>Signed in as <strong>{{ username }}</strong></span>
        <button class="button secondary small" type="button" :disabled="busy || loading || starting" @click="signOut">Log out</button>
      </div>
    </header>

    <main v-if="starting" class="page" aria-busy="true">
      <p role="status">Loading your session…</p>
    </main>

    <main v-else-if="!signedIn" class="login-page">
      <section class="panel login-panel" aria-labelledby="login-title">
        <h1 id="login-title">Product Management</h1>
        <p class="muted">Log in to manage your products.</p>
        <p v-if="sessionNotice" class="alert" role="status">{{ sessionNotice }}</p>
        <p v-if="error" class="alert error" role="alert">{{ error }}</p>
        <form @submit.prevent="signIn">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" ref="loginInput" v-model="login.username" name="username" autocomplete="username" maxlength="100" required :disabled="busy" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" v-model="login.password" name="password" type="password" autocomplete="current-password" required :disabled="busy" />
          </div>
          <button class="button login-button" type="submit" :disabled="busy">{{ busy ? 'Logging in…' : 'Log in' }}</button>
        </form>
      </section>
    </main>

    <main v-else class="page">
      <div class="page-heading">
        <div>
          <h1>{{ mode === 'form' ? (editingId !== null ? 'Edit product' : 'Add product') : 'Product Management' }}</h1>
          <p class="muted">{{ mode === 'form' ? 'Enter the product details below.' : 'View and manage your products.' }}</p>
        </div>
        <button v-if="mode === 'list'" class="button" type="button" :disabled="busy || loading" @click="openForm()">Add product</button>
      </div>

      <p v-if="notice" class="alert success" role="status">{{ notice }}</p>
      <p v-if="error" class="alert error" role="alert">{{ error }}</p>

      <section v-if="mode === 'list'" class="panel products-panel" aria-labelledby="products-title" :aria-busy="loading">
        <div class="section-heading">
          <h2 id="products-title">Products</h2>
          <button class="button secondary small" type="button" :disabled="busy || loading" @click="loadProducts">{{ loading ? 'Loading…' : 'Refresh' }}</button>
        </div>
        <div class="table-wrap">
          <table>
            <caption class="sr-only">Product inventory with price, quantity, and edit or delete actions</caption>
            <thead><tr><th scope="col">Product</th><th scope="col">Description</th><th scope="col">Price</th><th scope="col">Quantity</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              <tr v-if="loading && products.length === 0"><td colspan="5" class="empty" role="status">Loading products…</td></tr>
              <tr v-else-if="!products.length"><td colspan="5" class="empty">{{ error ? 'Products are unavailable. Try Refresh.' : 'No products yet. Add your first product.' }}</td></tr>
              <tr v-for="product in products" :key="product.id">
                <th scope="row" class="product-name">{{ product.product_name }}</th>
                <td class="description">{{ product.description }}</td>
                <td class="price">{{ money.format(Number(product.price)) }}</td>
                <td>{{ product.quantity }}</td>
                <td><div class="row-actions">
                  <button class="text-button" type="button" :disabled="busy || loading" :aria-label="`Edit ${product.product_name}`" @click="openForm(product)">Edit</button>
                  <button class="text-button danger-text" type="button" :disabled="busy || loading" :aria-label="`Delete ${product.product_name}`" @click="confirmDelete(product)">Delete</button>
                </div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else class="panel form-panel">
        <form @submit.prevent="saveProduct">
          <fieldset :disabled="busy">
            <legend class="sr-only">Product details</legend>
            <div class="field">
              <label for="product-name">Product name</label>
              <input id="product-name" ref="nameInput" v-model="fields.product_name" name="product_name" maxlength="100" required :aria-invalid="Boolean(fieldErrors.product_name)" :aria-describedby="fieldErrors.product_name ? 'product-name-error' : undefined" />
              <p v-if="fieldErrors.product_name" id="product-name-error" class="field-error">{{ fieldErrors.product_name }}</p>
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea id="description" v-model="fields.description" name="description" rows="4" required :aria-invalid="Boolean(fieldErrors.description)" :aria-describedby="fieldErrors.description ? 'description-error' : undefined"></textarea>
              <p v-if="fieldErrors.description" id="description-error" class="field-error">{{ fieldErrors.description }}</p>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="price">Price (₱)</label>
                <input id="price" v-model="fields.price" name="price" type="number" min="0" max="99999999.99" step="0.01" required :aria-invalid="Boolean(fieldErrors.price)" :aria-describedby="fieldErrors.price ? 'price-error' : undefined" />
                <p v-if="fieldErrors.price" id="price-error" class="field-error">{{ fieldErrors.price }}</p>
              </div>
              <div class="field">
                <label for="quantity">Quantity</label>
                <input id="quantity" v-model="fields.quantity" name="quantity" type="number" min="0" max="2147483647" step="1" required :aria-invalid="Boolean(fieldErrors.quantity)" :aria-describedby="fieldErrors.quantity ? 'quantity-error' : undefined" />
                <p v-if="fieldErrors.quantity" id="quantity-error" class="field-error">{{ fieldErrors.quantity }}</p>
              </div>
            </div>
            <div class="form-actions">
              <button class="button secondary" type="button" @click="cancelForm">Cancel</button>
              <button class="button" type="submit">{{ busy ? 'Saving…' : editingId !== null ? 'Save changes' : 'Add product' }}</button>
            </div>
          </fieldset>
        </form>
      </section>
    </main>

    <footer>Aljon Vincent E. Ferriol &middot; MCC2024-00052 &middot; ferriol.aljone@minsu.edu.ph</footer>

    <dialog ref="deleteDialog" aria-labelledby="delete-title" aria-describedby="delete-description" @cancel.prevent="cancelDelete">
      <h2 id="delete-title">Delete product?</h2>
      <p id="delete-description">Delete <strong>{{ deleteTarget?.product_name }}</strong>? This cannot be undone.</p>
      <p v-if="deleteError" class="alert error" role="alert">{{ deleteError }}</p>
      <div class="form-actions">
        <button class="button secondary" type="button" autofocus :disabled="busy" @click="cancelDelete">Cancel</button>
        <button class="button danger" type="button" :disabled="busy" @click="deleteProduct">{{ busy ? 'Deleting…' : 'Delete product' }}</button>
      </div>
    </dialog>
  </div>
</template>
