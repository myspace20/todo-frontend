import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import awsconfig from "./aws-exports";
import { Amplify } from "aws-amplify";


Amplify.configure(awsconfig);


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
