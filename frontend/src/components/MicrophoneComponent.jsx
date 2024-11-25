import React, { useState, useRef } from "react";

const MicrophoneComponent = () => {
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const startMicrophone = async () => {
    try {
      const mediaStream = await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false,
        })
        .catch((err) => {
          window.chrome.tabs.create({
            url: "./permissions/mic_permission.html",
          });
        });

      setStream(mediaStream);
      setIsRecording(true);
      setError(null);

      mediaRecorder.current = new MediaRecorder(mediaStream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);
      };

      mediaRecorder.current.start();

      chrome.runtime.sendMessage({
        type: "MEDIA_STATUS_SUCCESS",
        status: "recording",
      });
    } catch (error) {
      handleError(error);
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      chrome.runtime.sendMessage({
        type: "MICROPHONE_STATUS",
        status: "stopped",
      });
      setStream(null);
      setIsRecording(false);
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

    chrome.runtime.sendMessage({
      type: "MICROPHONE_ERROR",
      error: error.message,
    });
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      a.href = audioUrl;
      a.download = "recorded_audio.webm";
      a.click();
      window.URL.revokeObjectURL(audioUrl);
    }
  };

  return (
    <div>
      <h2>Microphone Access and Recording</h2>
      {!isRecording ? (
        <button onClick={startMicrophone}>Start Recording</button>
      ) : (
        <button onClick={stopMicrophone}>Stop Recording</button>
      )}
      {isRecording && <p>Recording in progress...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {audioUrl && (
        <div>
          <audio src={audioUrl} controls />
          <button onClick={downloadAudio}>Download Recording</button>
        </div>
      )}
    </div>
  );
};

export default MicrophoneComponent;
