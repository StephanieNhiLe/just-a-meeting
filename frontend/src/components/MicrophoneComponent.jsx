import React, { useState, useRef, useEffect } from "react";

const MicrophoneComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [diarizedTranscript, setDiarizedTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const summarizer = useRef(null);
  const mediaRecorder = useRef(null);
  const socket = useRef(null);
  const audioChunks = useRef([]);

  const deepgramApiKey = "30042a1f8625658f0e20fa46e4953fc702ddf351"; // Replace with your actual API key

  const initializeSummarizer = async () => {
    try {
      const canSummarize = await ai.summarizer.capabilities();
      if (canSummarize && canSummarize.available !== "no") {
        summarizer.current = await ai.summarizer.create();
        if (canSummarize.available !== "readily") {
          summarizer.current.addEventListener("downloadprogress", (e) => {
            console.log(`Summarizer download progress: ${e.loaded}/${e.total}`);
          });
          await summarizer.current.ready;
        }
        console.log("Summarizer initialized successfully");
      } else {
        console.error("Summarizer is not available");
      }
    } catch (error) {
      console.error("Error initializing summarizer:", error);
    }
  };

  useEffect(() => {
    initializeSummarizer();

    return () => {
      if (socket.current) {
        socket.current.close();
      }
      if (summarizer.current) {
        summarizer.current.destroy();
      }
    };
  }, []);

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
      audioChunks.current = []; // Reset audio chunks
      
      socket.current = new WebSocket("wss://api.deepgram.com/v1/listen", [
        "token",
        deepgramApiKey,
      ]);

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
          // Live transcription without diarization
          const newTranscript = result.channel.alternatives[0].transcript;
          setLiveTranscript((prev) => prev + newTranscript + "\n");
        }
      };

      // Handle WebSocket errors
      socket.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection failed.");
      };

      // Handle MediaRecorder data
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(event.data);
          }
        }
      };
    } catch (error) {
      // handleError(error);
      if (error.name === "NotAllowedError") {
        chrome.runtime.sendMessage({
          type: "MICROPHONE_ERROR",
          error: error.message,
        });
        chrome.tabs.create({
          url: chrome.runtime.getURL("./permissions/mic_permission.html"),
        });
      }
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

      chrome.runtime.sendMessage({
        type: "Diarized",
        error: data.results,
        load: audioChunks.current,
      });

      if (data.results?.channels?.[0]?.alternatives?.[0]) {
        const words = data.results.channels[0].alternatives[0].words;
        const diarizedText = formatDiarizedTranscript(words);
        setDiarizedTranscript(diarizedText);
        await summarizeTranscript(diarizedText);
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
          transcript += `Speaker ${currentSpeaker}: ${currentSentence.join(
            " "
          )}\n`;
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

  const summarizeTranscript = async (transcript) => {
    if (!summarizer.current) {
      console.error("Summarizer not initialized");
      return;
    }

    try {
      const result = await summarizer.current.summarize(transcript);
      chrome.runtime.sendMessage({
        type: "Result",
        error: result,
      });
      setSummary(result);
    } catch (error) {
      console.error("Summarization error:", error);
      setError("Failed to summarize the text.");
    }
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
