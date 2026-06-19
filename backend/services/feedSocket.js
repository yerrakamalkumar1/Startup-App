module.exports = function feedSocket(io, mainSocket) {
  const feedNamespace = io?.of ? io.of("/feed") : null;

  if (!feedNamespace) {
    if (mainSocket) {
      mainSocket.on("feed:subscribe", (userId) => {
        if (userId) mainSocket.join("feed_" + userId);
      });
      mainSocket.on("feed:unsubscribe", (userId) => {
        if (userId) mainSocket.leave("feed_" + userId);
      });
    }
    return;
  }

  feedNamespace.on("connection", (socket) => {
    console.log(`[FeedSocket] Client connected: ${socket.id}`);

    socket.on("subscribe", (userId) => {
      if (userId) {
        socket.join("user_feed_" + userId);
        console.log(`[FeedSocket] ${userId} subscribed to feed`);
      }
    });

    socket.on("unsubscribe", (userId) => {
      if (userId) {
        socket.leave("user_feed_" + userId);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[FeedSocket] Client disconnected: ${socket.id}`);
    });
  });

  feedNamespace.emitToUser = (userId, event, data) => {
    feedNamespace.to("user_feed_" + userId).emit(event, data);
  };

  feedNamespace.emitToAll = (event, data) => {
    feedNamespace.emit(event, data);
  };
};
