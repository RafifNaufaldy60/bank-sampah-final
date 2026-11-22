import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { api, session, normalizeError } from '../../services/api'

export const checkSession = createAsyncThunk('auth/checkSession', async (_, { rejectWithValue }) => {
  const token = session.read()?.token
  if (!token) return null
  try { return (await api.get('/auth/me')).data.data }
  catch (error) {
    const normalized = normalizeError(error)
    if (normalized.status === 401) { if (session.read()?.token === token) session.clear(); return null }
    return rejectWithValue(normalized)
  }
}, { condition: (arg, { getState }) => {
  const auth = getState().auth
  return auth.sessionStatus !== 'loading' && auth.logoutStatus !== 'loading' && (!auth.initialized || arg?.retry === true)
} })

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = (await api.post('/auth/login', { email: credentials.email.trim().toLowerCase(), password: credentials.password, ...(credentials.peran ? { peran: credentials.peran } : {}) })).data
    session.write({ token: data.token, expires_at: data.expires_at })
    return data.akun
  } catch (error) { return rejectWithValue({ ...normalizeError(error), email: credentials.email.trim().toLowerCase() }) }
}, { condition: (_, { getState }) => getState().auth.loginStatus !== 'loading' })

export const register = createAsyncThunk('auth/register', async (input, { rejectWithValue }) => {
  try { return (await api.post('/auth/register', input)).data.data }
  catch (error) { return rejectWithValue(normalizeError(error)) }
}, { condition: (_, { getState }) => getState().auth.registerStatus !== 'loading' })

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try { await api.post('/auth/logout') }
  catch (error) {
    if (error.response?.status !== 401) return rejectWithValue({ ...normalizeError(error), message: 'Logout belum berhasil: server belum mengonfirmasi pencabutan sesi. Silakan coba lagi.' })
  }
  session.clear()
}, { condition: (_, { getState }) => getState().auth.logoutStatus !== 'loading' })

const initialState = {
  user: null, initialized: false, sessionStatus: 'idle', sessionRequestId: null,
  loginStatus: 'idle', registerStatus: 'idle', logoutStatus: 'idle',
  sessionError: null, loginError: null, registerError: null, logoutError: null,
  locks: {}, notice: null,
}
const slice = createSlice({
  name: 'auth', initialState,
  reducers: {
    dismissNotice(state) { state.notice = null },
    clearFormErrors(state) { state.loginError = null; state.registerError = null },
  },
  extraReducers: builder => {
    builder
      .addCase(checkSession.pending, (state, action) => { state.sessionStatus = 'loading'; state.sessionRequestId = action.meta.requestId; state.sessionError = null })
      .addCase(checkSession.fulfilled, (state, action) => {
        if (state.sessionRequestId !== action.meta.requestId) return
        state.user = action.payload; state.initialized = true; state.sessionStatus = 'succeeded'; state.sessionRequestId = null
      })
      .addCase(checkSession.rejected, (state, action) => {
        if (state.sessionRequestId !== action.meta.requestId) return
        state.initialized = true; state.sessionStatus = 'failed'; state.sessionError = action.payload; state.sessionRequestId = null
      })
      .addCase(login.pending, state => { state.loginStatus = 'loading'; state.loginError = null; state.sessionRequestId = null })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload; state.initialized = true; state.sessionStatus = 'succeeded'; state.sessionError = null
        state.loginStatus = 'succeeded'; state.logoutError = null
        delete state.locks[action.payload.email.toLowerCase()]
        state.notice = { type: 'login', peran: action.payload.peran }
      })
      .addCase(login.rejected, (state, action) => {
        state.loginStatus = 'failed'; state.loginError = action.payload
        if (action.payload?.code === 'LOGIN_LOCKED') state.locks[action.payload.email] = action.payload.deadline
      })
      .addCase(register.pending, state => { state.registerStatus = 'loading'; state.registerError = null })
      .addCase(register.fulfilled, state => { state.registerStatus = 'succeeded' })
      .addCase(register.rejected, (state, action) => { state.registerStatus = 'failed'; state.registerError = action.payload })
      .addCase(logout.pending, state => {
        state.logoutStatus = 'loading'; state.logoutError = null; state.sessionRequestId = null; state.notice = null
        state.sessionStatus = 'succeeded'; state.sessionError = null
      })
      .addCase(logout.fulfilled, state => {
        state.user = null; state.initialized = true; state.logoutStatus = 'succeeded'; state.loginStatus = 'idle'
      })
      .addCase(logout.rejected, (state, action) => { state.logoutStatus = 'failed'; state.logoutError = action.payload })
  },
})
export const { dismissNotice, clearFormErrors } = slice.actions
export default slice.reducer
