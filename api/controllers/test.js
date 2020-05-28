const { exec } = require("child_process");
// const cmd = "ffmpeg -re -i /home/datdq/Documents/streaming_app/resourceVideos/30s.mp4 -c:v libx264 -preset superfast -tune zerolatency -c:a aac -ar 44100 -f flv rtmp://localhost/live/STREAM_NAME";
const cmd = "ffmpeg -re -i rtmp://rtmp.mstone.online/live -c:v libx264 -preset superfast -tune zerolatency -c:a aac -ar 44100 -f flv rtmp://localhost/live/STREAM_NAME";

function start(req, res, next) {
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      res.json({ error: err }, 500);
      return
    }

    // the *entire* stdout and stderr (buffered)
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
    res.json(cmd);
  });
}

function stop(req, res, next) {
  const kill = `kill $(ps aux | grep "${cmd}" | awk '{print $2}')`
  exec(kill, (err, stdout, stderr) => {
    if (err) {
      res.json({ error: err }, 500);
    }

    // the *entire* stdout and stderr (buffered)
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
    res.json(kill);
  });
}

exports.start = start;
exports.stop = stop;
