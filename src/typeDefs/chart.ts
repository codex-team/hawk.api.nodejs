import { gql } from 'apollo-server-express';

export default gql`
  type ChartDataItem {
    """
    Events timestamp
    """
    timestamp: Int

    """
    Amount of events
    """
    count: Int
  }

  """
  Project chart data split by metric type
  """
  type ProjectChartSeries {
    """
    Accepted events (successfully processed)
    """
    accepted: [ChartDataItem!]!

    """
    Events rejected due to rate limiting
    """
    rateLimited: [ChartDataItem!]
  }
`;
