import { configureStore } from '@reduxjs/toolkit'
import auth from '../features/auth/authSlice'

// createAsyncThunk puts its input in meta.arg. Strip credentials before any action reaches reducers/tooling.
export const redactCredentials = () => next => action => {
  if (typeof action === 'object' && /^auth\/(login|register)\//.test(action.type)) {
    return next({ ...action, meta: { ...action.meta, arg: undefined } })
  }
  return next(action)
}
export const createAppStore = () => configureStore({
  reducer: { auth },
  middleware: getDefaultMiddleware => getDefaultMiddleware().prepend(redactCredentials),
  // Credentials must never appear in Redux DevTools (including thunk arguments).
  devTools: false,
})
export const store = createAppStore()
