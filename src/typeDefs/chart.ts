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
    totalCount: Int
  }
`;
