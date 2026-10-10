import Icon from "./Icon";
export default function Guide() {
  return (
    <div className="guide-page">
      <div className="page-heading">
        <div>
          <h1>A little context. A clearer view.</h1>
          <p>Get comfortable with your personal market workspace.</p>
        </div>
        <a href="#home" className="button primary">
          Open dashboard <Icon name="arrow" size={18} />
        </a>
      </div>
      <div className="guide-intro panel">
        <div className="guide-symbol">
          <Icon name="activity" size={42} />
        </div>
        <div>
          <h2>Make the signal easier to see.</h2>
          <p>
            Pulse brings market prices, conversation sentiment, and technical
            indicators into one place. Use it to organize your research before
            making an intraday trading decision.
          </p>
        </div>
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
            "Compare the sentiment score with price momentum, RSI, and session VWAP. Open price levels to explore a transparent ATR-based scenario. No single indicator tells the whole story.",
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
                illustrative long scenario uses the latest price, a stop 1.5 ATR
                below it, and a target 3 ATR above it. It excludes fees,
                slippage, and position sizing.
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
              If the newest headline is 24 hours old or more, Pulse labels the
              sample as background context and withholds the intraday summary.
              Sentiment charts show actual headline observations in the selected
              period. Empty charts mean there were fewer than two observations;
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
          analysis. It does not reproduce its AI decisions, author-diversity
          analysis, or calibrated confidence claims.
        </p>
        <p className="disclaimer">
          Research support only. Sentiment and technical levels are not
          investment advice or a guarantee of future price movement.
        </p>
      </section>
    </div>
  );
}
