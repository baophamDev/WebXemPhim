import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { cinemaApi } from './api';
export const store=configureStore({reducer:{[cinemaApi.reducerPath]:cinemaApi.reducer},middleware:(getDefault)=>getDefault().concat(cinemaApi.middleware)});
setupListeners(store.dispatch);
