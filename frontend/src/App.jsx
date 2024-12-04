import { useState } from 'react'
import './App.css'
import MicrophoneComponent from './components/MicrophoneComponent'
import Header from './components/Header';


function App() {
  return (
    <>
      <div className='app'>
        <Header/>
        <MicrophoneComponent />
      </div>
    </>
  )
}

export default App
