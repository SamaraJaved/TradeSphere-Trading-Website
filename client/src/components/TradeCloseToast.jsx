import { useEffect, useState } from "react";

const TRADE_CLOSED_EVENT = "tradesphere-trade-closed";

const CLOSE_REASON_LABEL = {
  manual: "Position closed manually",
  stop_loss: "Stop Loss reached",
  take_profit: "Take Profit reached",
  cancelled: "Position cancelled",
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(value) {
  const number = Number(value || 0);

  if (number > 0) {
    return `+$${formatMoney(number)}`;
  }

  if (number < 0) {
    return `-$${formatMoney(Math.abs(number))}`;
  }

  return "$0.00";
}

function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();

    function scheduleChime() {
      const now = audioContext.currentTime;

      [
        { frequency: 880, start: 0, duration: 0.11 },
        { frequency: 1175, start: 0.11, duration: 0.16 },
      ].forEach(
        ({ frequency, start, duration }) => {
          const oscillator =
            audioContext.createOscillator();
          const gainNode =
            audioContext.createGain();

          oscillator.type = "sine";
          oscillator.frequency.value =
            frequency;

          gainNode.gain.setValueAtTime(
            0,
            now + start
          );
          gainNode.gain.linearRampToValueAtTime(
            0.18,
            now + start + 0.015
          );
          gainNode.gain.exponentialRampToValueAtTime(
            0.0001,
            now + start + duration
          );

          oscillator.connect(gainNode);
          gainNode.connect(
            audioContext.destination
          );

          oscillator.start(now + start);
          oscillator.stop(
            now + start + duration + 0.02
          );
        }
      );

      setTimeout(() => {
        audioContext.close().catch(() => {});
      }, 500);
    }

    /*
      A freshly created AudioContext starts
      "suspended" in most browsers until it is
      explicitly resumed. Without this, the
      oscillators schedule successfully but no
      sound is ever produced, silently.
    */
    if (audioContext.state === "suspended") {
      audioContext
        .resume()
        .then(scheduleChime)
        .catch((error) => {
          console.error(
            "Could not resume audio context:",
            error
          );
        });
    } else {
      scheduleChime();
    }
  } catch (error) {
    console.error(
      "Could not play notification sound:",
      error
    );
  }
}

function createToastFromTrade(trade) {
  const profitLoss = Number(trade.profitLoss || 0);

  const resultLabel =
    profitLoss > 0
      ? "PROFIT"
      : profitLoss < 0
        ? "LOSS"
        : "BREAK-EVEN";

  const resultClass =
    profitLoss > 0
      ? "profit"
      : profitLoss < 0
        ? "loss"
        : "even";

  const resultIcon =
    profitLoss > 0
      ? "✓"
      : profitLoss < 0
        ? "✕"
        : "–";

  return {
    id: `${trade._id || trade.id}-${Date.now()}`,
    side: trade.side,
    asset: trade.asset,
    closeReason: trade.closeReason,
    reasonLabel:
      CLOSE_REASON_LABEL[trade.closeReason] ||
      "Position closed",
    closingPrice: trade.closingPrice,
    profitLoss,
    resultLabel,
    resultClass,
    resultIcon,
  };
}

function TradeCloseToast() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    function handleTradeClosed(event) {
      const trade = event.detail?.trade;

      if (!trade) {
        return;
      }

      const toast = createToastFromTrade(trade);

      setQueue((previousQueue) => [
        ...previousQueue,
        toast,
      ]);
    }

    window.addEventListener(
      TRADE_CLOSED_EVENT,
      handleTradeClosed
    );

    return () => {
      window.removeEventListener(
        TRADE_CLOSED_EVENT,
        handleTradeClosed
      );
    };
  }, []);

  useEffect(() => {
    if (current || queue.length === 0) {
      return;
    }

    const [nextToast, ...remainingQueue] = queue;

    setCurrent(nextToast);
    setQueue(remainingQueue);
    playNotificationSound();
  }, [current, queue]);

  function dismissCurrentToast() {
    setCurrent(null);
  }

  if (!current) {
    return null;
  }

  return (
    <div className="trade-close-overlay">
      <div
        className={`trade-close-modal ${current.resultClass}`}
        role="alertdialog"
        aria-live="assertive"
      >
        <button
          type="button"
          className="trade-close-modal-dismiss"
          aria-label="Dismiss notification"
          onClick={dismissCurrentToast}
        >
          ×
        </button>

        <div
          className={`trade-close-modal-icon ${current.resultClass}`}
        >
          {current.resultIcon}
        </div>

        <span className="trade-close-modal-reason">
          {current.reasonLabel}
        </span>

        <h3 className="trade-close-modal-title">
          {current.side === "sell" ? "SELL" : "BUY"}{" "}
          {current.asset} closed at $
          {formatMoney(current.closingPrice)}
        </h3>

        <span
          className={`trade-close-modal-result ${current.resultClass}`}
        >
          {current.resultLabel}{" "}
          {formatSignedMoney(current.profitLoss)}
        </span>

        <button
          type="button"
          className={`trade-close-modal-button ${current.resultClass}`}
          onClick={dismissCurrentToast}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default TradeCloseToast;
