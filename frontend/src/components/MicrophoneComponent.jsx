import React, { useState, useRef, useEffect } from "react";

const MicrophoneComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [diarizedTranscript, setDiarizedTranscript] = useState("");
  const [summary, setSummary] = useState(""); // Added missing summary state
  const mediaRecorder = useRef(null);
  const socket = useRef(null);
  const audioChunks = useRef([]); // Retained for potential use in audio processing

  const deepgramApiKey = ""; // Replace with your actual API key

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
      setSummary("");

      mediaRecorder.current = new MediaRecorder(mediaStream);
      socket.current = new WebSocket(
        "wss://api.deepgram.com/v1/listen?diarize=true&endpointing=1000&utterance_end=1000",
        ["token", deepgramApiKey]
      );

      // Handle WebSocket connection
      socket.current.onopen = () => {
        console.log("WebSocket connected.");
        mediaRecorder.current.start(250); // Record in 250ms chunks
      };

      // // Handle incoming transcription
      // socket.current.onmessage = (event) => {
      //   const result = JSON.parse(event.data);
      //   if (result.channel?.alternatives?.[0]) {
      //     const newTranscript = result.channel.alternatives[0].transcript;
      //     setLiveTranscript((prev) => prev + newTranscript + "\n");
      //     summarizeTranscript(newTranscript); // Summarize the transcript
      //   }
      // };

      socket.current.onmessage = (event) => {
        const result = JSON.parse(event.data);
      
        if (result.channel?.alternatives?.[0]) {
          // Live transcription
          const newTranscript = result.channel.alternatives[0].transcript;
          setLiveTranscript((prev) => prev + newTranscript + "\n");
          summarizeTranscript(newTranscript);
      
          // Diarization
          const words = result.channel.alternatives[0].words;
          if (words?.length > 0 && words.some((word) => word.speaker !== undefined)) {
            const newDiarizedText = formatDiarizedTranscript(words);
            setDiarizedTranscript((prev) => prev + newDiarizedText + "\n");
          } else {
            console.warn("No speaker data found in words.");
          }
        }
      };
      

      // Handle WebSocket errors
      socket.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection failed.");
      };

      // Handle MediaRecorder data
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.current?.readyState === WebSocket.OPEN) {
          socket.current.send(event.data);
        }
      };
    } catch (error) {
      handleError(error);
    }
  };

  const stopMicrophone = async () => {
    if (mediaRecorder.current) {
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
      if (data.results?.channels?.[0]?.alternatives?.[0]) {
        const words = data.results.channels[0].alternatives[0].words;
        setDiarizedTranscript(formatDiarizedTranscript(words));
      }
    } catch (error) {
      handleError(error);
    }
  };

  const formatDiarizedTranscript = (words) => {
    let transcript = "";
    let currentSpeaker = null;
    let currentSentence = [];
  
    for (const word of words) {
      if (currentSpeaker === null || word.speaker !== currentSpeaker) {
        if (currentSentence.length > 0) {
          transcript += `Speaker ${currentSpeaker}: ${currentSentence.join(" ")}\n`;
          currentSentence = [];
        }
        currentSpeaker = word.speaker;
      }
      currentSentence.push(word.word);
    }
  
    if (currentSentence.length > 0) {
      transcript += `Speaker ${currentSpeaker}: ${currentSentence.join(" ")}`;
    }
  
    // Simplify for single-speaker scenario
    const uniqueSpeakers = [...new Set(words.map((w) => w.speaker))];
    if (uniqueSpeakers.length === 1) {
      transcript = transcript.replace(/Speaker \d+: /g, "");
    }
  
    return transcript;
  };
  

  const summarizeTranscript = (transcript) => {
    chrome.runtime.sendMessage(
      { type: "SUMMARIZE_TRANSCRIPT", transcript },
      (response) => {
        if (response.success) {
          setSummary(response.summary);
        } else {
          console.error("Summarization Error:", response.error);
          setError("Failed to summarize the text.");
        }
      }
    );
  };

  const handleError = (error) => {
    let errorMessage = "An error occurred while trying to access the microphone.";
    if (error.name === "NotAllowedError") {
      errorMessage = "Microphone access was denied. Please check your browser settings.";
    } else if (error.name === "NotFoundError") {
      errorMessage = "No microphone was found on your device.";
    } else if (error.name === "NotReadableError") {
      errorMessage = "Your microphone is busy or already in use.";
    }
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
        <pre>{diarizedTranscript || "No diarized data available."}</pre>
      </div>
      <div>
        <h3>Summary:</h3>
        <pre>{summary}</pre>
      </div>
    </div>
  );
};

export default MicrophoneComponent;
