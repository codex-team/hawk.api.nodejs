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
  Chart line definition
  """
  type ChartLine {
    """
    Series label (e.g., events-accepted)
    """
    label: String!

    """
    Data points for the series
    """
    data: [ChartDataItem!]!
  }
`;
