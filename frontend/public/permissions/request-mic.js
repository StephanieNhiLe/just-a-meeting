navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    // You can handle the stream here if necessary
    console.log('Microphone access granted!');
    // You could also store the stream or pass it to another function
  })
  .catch(err => {
    console.error('Error accessing microphone:', err);
    alert('Microphone permission denied!');
  });