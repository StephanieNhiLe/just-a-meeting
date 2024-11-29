import React, { useState, useRef, useEffect } from "react";
import { createClient } from "@deepgram/sdk";

const MicrophoneComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [diarizedTranscript, setDiarizedTranscript] = useState("");
  const mediaRecorder = useRef(null);
  const socket = useRef(null);
  const audioChunks = useRef([]);

  const deepgramApiKey = "";

  const startMicrophone = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      setIsRecording(true);
      setError(null);
      setLiveTranscript("");
      setDiarizedTranscript("");
      audioChunks.current = [];

      mediaRecorder.current = new MediaRecorder(mediaStream);

      socket.current = new WebSocket(
        "wss://api.deepgram.com/v1/listen?endpointing=1000&utterance_end=1000",
        ["token", deepgramApiKey]
      );

      socket.current.onopen = () => {
        mediaRecorder.current.start(250);
      };

      socket.current.onmessage = (event) => {
        const result = JSON.parse(event.data);
        if (result.channel?.alternatives?.[0]) {
          const newTranscript = result.channel.alternatives[0].transcript;
          setLiveTranscript((prev) => prev + newTranscript + "\n");
        }
      };

      socket.current.onerror = (error) => {
        handleError(error);
      };

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(event.data);
          }
        }
      };
    } catch (error) {
      handleError(error);
    }
  };

  const stopMicrophone = async () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    if (socket.current) {
      socket.current.close();
    }
    setIsRecording(false);

    const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");

      const response = await fetch(
        "https://api.deepgram.com/v1/listen?diarize=true",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramApiKey}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      chrome.runtime.sendMessage({
        result: "Received",
        data: data,
      });
      if (data.results?.channels?.[0]?.alternatives?.[0]) {
        const words = data.results.channels[0].alternatives[0].words;
        const diarizedText = formatDiarizedTranscript(words);
        setDiarizedTranscript(diarizedText);
      }
    } catch (error) {
      handleError(error);
    }
  };

  const formatDiarizedTranscript = (words) => {
    let transcript = '';
    let currentSpeaker = null;
    let currentSentence = [];

    for (const word of words) {
      if (currentSpeaker === null || word.speaker !== currentSpeaker) {
        if (currentSentence.length > 0) {
          transcript += `Speaker ${currentSpeaker}: ${currentSentence.join(' ')}\n`;
          currentSentence = [];
        }
        currentSpeaker = word.speaker;
      }
      currentSentence.push(word.word);
    }

    if (currentSentence.length > 0) {
      transcript += `Speaker ${currentSpeaker}: ${currentSentence.join(' ')}`;
    }

    return transcript;
  };

  const handleError = (error) => {
    let errorMessage =
      "An error occurred while trying to access the microphone.";
    if (error.name === "NotAllowedError") {
      errorMessage =
        "Microphone access was denied. Please check your browser settings.";
    } else if (error.name === "NotFoundError") {
      errorMessage = "No microphone was found on your device.";
    } else if (error.name === "NotReadableError") {
      errorMessage = "Your microphone is busy or already in use.";
    }
    chrome.runtime.sendMessage({
      result: "ERROR",
      data: error.message,
    });
    setError(errorMessage);
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, []);

  return (
    <div>
      <h2>Live Speech-to-Text Transcription with Deepgram</h2>
      {!isRecording ? (
        <button onClick={startMicrophone}>Start Recording</button>
      ) : (
        <button onClick={stopMicrophone}>Stop Recording</button>
      )}
      {isRecording && <p>Recording and transcribing...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div>
        <h3>Live Transcript:</h3>
        <pre>{liveTranscript}</pre>
      </div>
      <div>
        <h3>Diarized Transcript:</h3>
        <pre>{diarizedTranscript}</pre>
      </div>
    </div>
  );
};

export default MicrophoneComponent;
