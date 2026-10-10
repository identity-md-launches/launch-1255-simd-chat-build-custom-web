import Icon from "./Icon";
export default function Guide() {
  return (
    <div className="guide-page">
      <div className="page-heading">
        <div>
          <h1>How to use Pulse</h1>
        </div>
        <a href="#home" className="button primary">
          Open dashboard <Icon name="arrow" size={18} />
        </a>
      </div>
      <div className="guide-steps">
        {[
          [
            "01",
            "Choose your market",
            "Select Bitcoin, Ethereum, Solana, or Chainlink. The initial workspace uses clearly labeled example data so you can explore every feature.",
          ],
          [
            "02",
            "Analyze the latest data",
            "Select Analyze market to fetch public prices and recent Hacker News headlines. Each source shows its own status. Pause automatic refresh whenever you need a stable view.",
          ],
          [
            "03",
            "Read signals together",
            "Read the action, rationale, and confidence in The market read. Open price levels for an aligned entry, or add optional position context to check the profit-taking rule.",
          ],
        ].map(([n, title, text]) => (
          <section className="panel guide-step" key={n}>
            <span className="step-number">{n}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <div className="guide-columns">
        <section className="panel prose">
          <h2>What the numbers mean</h2>
          <dl className="definition-list">
            <div>
              <dt>Sentiment score · 0–100</dt>
              <dd>
                The average score of fetched headline titles. Positive and
                negative keywords move each score above or below 50; nearby
                negation reverses a keyword’s sign. Every headline has equal
                weight.
              </dd>
            </div>
            <div>
              <dt>Bullish, neutral, or bearish</dt>
              <dd>
                By default, scores of 60 or higher are bullish and 40 or lower
                are bearish. Change the threshold in Settings. Neutral can mean
                balanced wording or no recognized keywords.
              </dd>
            </div>
            <div>
              <dt>RSI · 14 periods</dt>
              <dd>
                Wilder’s relative strength index, calculated on completed
                5-minute candles. Above 70 is commonly described as overbought;
                below 30 as oversold. Those labels do not predict a reversal.
              </dd>
            </div>
            <div>
              <dt>Session VWAP</dt>
              <dd>
                The volume-weighted average price from midnight UTC, using
                completed 5-minute candles. It provides a reference for the
                current price within this session.
              </dd>
            </div>
            <div>
              <dt>Funding & open interest</dt>
              <dd>
                Binance USDT perpetual futures funding is the latest reported
                rate per funding period, not an annualized rate. Period lengths
                can vary. Open interest is shown in units of the selected asset.
                Spot prices come from Kraken USD markets, so these reflect
                different venues and quotes.
              </dd>
            </div>
            <div>
              <dt>ATR & price levels</dt>
              <dd>
                ATR is the mean true range of the last 14 completed candles. The
                entry range is the latest price ±0.25 ATR. For Buy, the stop is
                1.5 ATR below that midpoint and the target 3 ATR above it. Sell
                means a short setup, with the stop above and target below.
                Reward/risk is 2:1 only at the midpoint, before fees and slippage;
                it changes with your fill. Hold and Take Profit have no new entry range.
              </dd>
            </div>
          </dl>
        </section>
        <div className="guide-stack">
          <section className="panel prose">
            <h2>Know what you’re reading</h2>
            <p>
              Live sentiment comes from up to 100 Hacker News story titles
              mentioning the asset in the last 7 days, newest first. This is a
              small technology-focused sample, not a representative measure of
              all traders or X activity.
            </p>
            <p>
              The keyword model cannot reliably understand sarcasm, context, or
              complex negation. Scores express wording, not a calibrated
              probability or expected return. Sparse samples deserve extra
              caution.
            </p>
            <p>
              Only headlines from the last 24 hours enter the decision; the
              sentiment metric can include the full seven-day sample. The action
              is unavailable if no fresh headlines remain, the price fetch is
              10 minutes old, the last completed candle is 15 minutes old, or
              required indicators are missing. Sentiment charts space observations
              by their publication times within the selected period. Empty charts mean there were fewer than two observations;
              Pulse does not invent missing points.
            </p>
          </section>
          <section className="panel prose">
            <h2>Bring your own context</h2>
            <p>
              Open Analyze text in the conversation panel and paste one headline
              or post per line. Up to 1,000 lines are scored entirely in your
              browser. Your text is never sent to a server or saved after you
              leave.
            </p>
            <p>
              These local results stay separate from the live dashboard. The
              displayed matched words make each result easy to inspect.
            </p>
          </section>
          <section className="panel prose">
            <h2>Your workspace stays yours</h2>
            <p>
              Settings are stored in this browser. There is no account, wallet
              connection, order execution, or private API key. Requests to
              public providers expose your IP address and the selected asset to
              those providers.
            </p>
            <p>
              Export a CSV to save a point-in-time record with source mode,
              timestamps, metrics, and analyzed headlines.
            </p>
          </section>
        </div>
      </div>
      <section className="panel prose sources-guide">
        <h2>How decisions work</h2>
        <p>
          With No position selected, Buy requires bullish fresh sentiment, price
          above session VWAP, and RSI strictly between 50 and 70. Sell requires
          bearish fresh sentiment, price below VWAP, and RSI strictly between
          30 and 50. All three must agree; otherwise the action is Hold.
        </p>
        <p>
          For an existing position, enter its side and average entry in Position
          context. Take Profit requires a profit before costs and RSI at least 70
          for a long, or at most 30 for a short. Otherwise it says Hold, which is
          not an assurance that the position is safe. These rules do not model
          your account, costs, leverage, or exit plan. Position context is unsaved
          and clears when you change market, data mode, or page.
        </p>
        <p>
          Confidence describes rule support and sample coverage, not a probability
          of profit. Hold is Low. For Buy, Sell, or Take Profit, confidence is Low
          below 5 fresh headlines or below 50% keyword coverage; with at least 5
          headlines it is Moderate at 50–79% coverage and High at 80% or more.
          Coverage means the share of titles with recognized sentiment words.
          Even High is uncalibrated and can be wrong.
        </p>
      </section>
      <section className="panel prose sources-guide">
        <h2>Sources & methodology</h2>
        <div className="source-links">
          <a
            href="https://docs.kraken.com/api-reference/market-data/get-ohlc-data"
            target="_blank"
            rel="noreferrer"
          >
            Kraken market data <Icon name="external" size={15} />
          </a>
          <a
            href="https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Mark-Price"
            target="_blank"
            rel="noreferrer"
          >
            Binance perpetual futures <Icon name="external" size={15} />
          </a>
          <a href="https://hn.algolia.com/api" target="_blank" rel="noreferrer">
            Hacker News via Algolia <Icon name="external" size={15} />
          </a>
          <a
            href="https://github.com/brainstormity/Jev-X-Sentiment-Analysis"
            target="_blank"
            rel="noreferrer"
          >
            Jev X reference project <Icon name="external" size={15} />
          </a>
        </div>
        <p>
          Pulse is an independent browser-only adaptation. It replaces the
          reference’s paid X and AI services with public data and local
          analysis. Buy, Sell, Hold, and Take Profit use the rules above, not the
          reference’s AI model. Author-diversity analysis and calibrated confidence
          are not reproduced. Funding and open interest remain context indicators;
          they do not enter these decision rules.
        </p>
        <p className="disclaimer">
          Research support only. Sentiment and technical levels are not
          investment advice or a guarantee of future price movement.
        </p>
      </section>
    </div>
  );
}
