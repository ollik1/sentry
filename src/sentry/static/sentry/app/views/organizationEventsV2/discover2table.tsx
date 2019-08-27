import React from 'react';
import {Location} from 'history';
import {omit} from 'lodash';
import {browserHistory} from 'react-router';
import styled from 'react-emotion';

import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization} from 'app/types';
import Pagination from 'app/components/pagination';
import Panel from 'app/components/panels/panel';
import {PanelBody} from 'app/components/panels';
import LoadingContainer from 'app/components/loading/loadingContainer';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';

import {DEFAULT_EVENT_VIEW_V1} from './data';
import {MetaType, getFieldRenderer, getQuery} from './utils';
import EventView from './eventView';
import SortLink from './sortLink';

type DataRow = {
  [key: string]: string;
};

// TODO: move this
type DataPayload = {
  data: Array<DataRow>;
  meta: MetaType;
};

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
};

type State = {
  eventView: EventView;
  loading: boolean;
  hasError: boolean;
  pageLinks: null | string;
  dataPayload: DataPayload | null | undefined;
};

class Discover2Table extends React.PureComponent<Props, State> {
  state: State = {
    eventView: EventView.fromLocation(this.props.location),
    loading: true,
    hasError: false,
    pageLinks: null,
    dataPayload: null,
  };

  static getDerivedStateFromProps(props: Props, state: State): State {
    return {
      ...state,
      eventView: EventView.fromLocation(props.location),
    };
  }

  componentDidMount() {
    const {location} = this.props;

    if (!this.state.eventView.isComplete()) {
      const nextEventView = EventView.fromEventViewv1(DEFAULT_EVENT_VIEW_V1);

      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          ...nextEventView.generateQueryStringObject(),
        },
      });
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.location !== prevProps.location) {
      this.fetchData();
    }
  }

  fetchData = () => {
    const {organization, location} = this.props;

    const url = `/organizations/${organization.slug}/eventsv2/`;

    this.props.api.request(url, {
      query: getQuery(this.state.eventView, location),
      success: (dataPayload, __textStatus, jqxhr) => {
        this.setState(prevState => {
          return {
            loading: false,
            hasError: false,
            pageLinks: jqxhr ? jqxhr.getResponseHeader('Link') : prevState.pageLinks,
            dataPayload,
          };
        });
      },
      error: _err => {
        this.setState({
          hasError: true,
        });
      },
    });
  };

  render() {
    const {organization, location} = this.props;
    const {pageLinks, eventView, loading, dataPayload} = this.state;

    return (
      <Container>
        <Table
          eventView={eventView}
          organization={organization}
          dataPayload={dataPayload}
          isLoading={loading}
          location={location}
        />
        <Pagination pageLinks={pageLinks} />
      </Container>
    );
  }
}

type TableProps = {
  organization: Organization;
  eventView: EventView;
  isLoading: boolean;
  dataPayload: DataPayload | null | undefined;
  location: Location;
};

type TableState = {
  expandColumn: null | number;
};

class Table extends React.Component<TableProps, TableState> {
  state: TableState = {
    expandColumn: null,
  };

  renderLoading = () => {
    return (
      <Panel>
        <PanelBody style={{minHeight: '240px'}}>
          <LoadingContainer isLoading={true} />
        </PanelBody>
      </Panel>
    );
  };

  renderHeader = () => {
    const {eventView, location, dataPayload} = this.props;

    if (eventView.fields.length <= 0) {
      return null;
    }

    const defaultSort = eventView.getDefaultSort() || eventView.fields[0].snuba_column;

    return eventView.fields.map((field, index) => {
      if (!dataPayload) {
        return <PanelHeaderCell key={index}>{field.title}</PanelHeaderCell>;
      }

      const {meta} = dataPayload;

      const sortKey = eventView.getSortKey(field.snuba_column, meta);

      if (sortKey === null) {
        return <PanelHeaderCell key={index}>{field.title}</PanelHeaderCell>;
      }

      return (
        <PanelHeaderCell key={index}>
          <SortLink
            defaultSort={defaultSort}
            sortKey={sortKey}
            title={field.title}
            location={location}
          />
        </PanelHeaderCell>
      );
    });
  };

  renderContent = (): React.ReactNode => {
    const {dataPayload, eventView, organization, location} = this.props;

    if (!(dataPayload && dataPayload.data && dataPayload.data.length > 0)) {
      return (
        <PanelGridInfo numOfCols={eventView.numOfColumns()}>
          <EmptyStateWarning>
            <p>{t('No results found')}</p>
          </EmptyStateWarning>
        </PanelGridInfo>
      );
    }

    const {meta} = dataPayload;
    const fields = eventView.getFieldSnubaCols();

    // TODO: deal with this
    // if (fields.length <= 0) {
    //   return (
    //     <PanelGridInfo numOfCols={1}>
    //       <EmptyStateWarning>
    //         <p>{t('No field column selected')}</p>
    //       </EmptyStateWarning>
    //     </PanelGridInfo>
    //   );
    // }

    const lastRowIndex = dataPayload.data.length - 1;

    const firstCellIndex = 0;
    const lastCellIndex = fields.length - 1;

    return dataPayload.data.map((row, rowIndex) => {
      return (
        <React.Fragment key={rowIndex}>
          {fields.map((field, columnIndex) => {
            const key = `${field}.${columnIndex}`;

            const fieldRenderer = getFieldRenderer(field, meta);
            return (
              <PanelItemCell
                hideBottomBorder={rowIndex === lastRowIndex}
                style={{
                  paddingLeft: columnIndex === firstCellIndex ? space(1) : void 0,
                  paddingRight: columnIndex === lastCellIndex ? space(1) : void 0,
                }}
                key={key}
                onMouseEnter={() => {
                  this.setState({
                    expandColumn: columnIndex,
                  });
                }}
                onMouseLeave={() => {
                  this.setState({
                    expandColumn: null,
                  });
                }}
                onMouseOver={() => {
                  this.setState({
                    expandColumn: columnIndex,
                  });
                }}
              >
                {fieldRenderer(row, {organization, location})}
              </PanelItemCell>
            );
          })}
        </React.Fragment>
      );
    });
  };

  renderTable = () => {
    return (
      <React.Fragment>
        {this.renderHeader()}
        {this.renderContent()}
      </React.Fragment>
    );
  };

  render() {
    const {isLoading, eventView} = this.props;

    if (isLoading) {
      return this.renderLoading();
    }

    return (
      <PanelGrid
        expandColumn={this.state.expandColumn}
        numOfCols={eventView.numOfColumns()}
      >
        {this.renderTable()}
      </PanelGrid>
    );
  }
}

type PanelGridProps = {
  numOfCols: number;
  expandColumn: number | null;
};

const PanelGrid = styled((props: PanelGridProps) => {
  const otherProps = omit(props, 'numOfCols', 'expandColumn');
  return <Panel {...otherProps} />;
})<PanelGridProps>`
  display: grid;

  overflow-x: auto;

  ${(props: PanelGridProps) => {
    const {expandColumn} = props;

    const firstColumn = expandColumn === 0 ? 'minmax(min-content, 3fr)' : '3fr';

    function generateRestColumns(): string {
      if (props.numOfCols <= 1) {
        return '';
      }

      if (expandColumn === null) {
        return `repeat(${props.numOfCols - 1}, auto)`;
      }

      const defaultWidth = 'auto';

      if (expandColumn === 0) {
        return `repeat(${props.numOfCols - 1}, ${defaultWidth})`;
      }

      let restColumns: string = '';
      for (let index = 1; index <= props.numOfCols - 1; index++) {
        if (expandColumn === index) {
          restColumns += ' min-content';
          continue;
        }

        restColumns += ` ${defaultWidth}`;
      }

      return restColumns;
    }

    return `
      grid-template-columns:  ${firstColumn} ${generateRestColumns()};
    `;
  }};
`;

const PanelHeaderCell = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite};
  line-height: 1;

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;

  padding: ${space(2)};

  /*
    By default, a grid item cannot be smaller than the size of its content.
    We override this by setting it to be 0.
  */
  min-width: 0;
`;

type PanelGridInfoProps = {
  numOfCols: number;
};

const PanelGridInfo = styled('div')<PanelGridInfoProps>`
  ${(props: PanelGridInfoProps) => {
    return `
  grid-column: 1 / span ${props.numOfCols};
  `;
  }};
`;

const PanelItemCell = styled('div')<{hideBottomBorder: boolean}>`
  border-bottom: ${p =>
    p.hideBottomBorder ? 'none' : `1px solid ${p.theme.borderLight}`};

  font-size: ${p => p.theme.fontSizeMedium};

  padding-top: ${space(1)};
  padding-bottom: ${space(1)};

  /*
    By default, a grid item cannot be smaller than the size of its content.
    We override this by setting it to be 0.
  */
  min-width: 0;
`;

const Container = styled('div')`
  min-width: 0;
  overflow: hidden;
`;

export default withApi<Props>(Discover2Table);
