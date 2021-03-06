import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classnames from 'classnames';

import StarRating from './starRating';
import BigRadioButton from './bigRadioButton';
import Card from './card';
import TooltipWrapper from './tooltipWrapper';
import Table from './shared/table';
import Tooltip from './shared/tooltip/tooltip';
import FakeDropdown from './fakeDropdown';
import CountryTooltip from './countryTooltip';
import RatingTooltip from './ratingTooltip';
import SliderTooltip from './sliderTooltip';
import SpeedGradient from './speedGradient';
import poolPropType from '../propTypes/pool';
import { poolsActions, poolsSelectors, poolsConstants } from '../state/ducks/pools';
import { applicationsSelectors } from '../state/ducks/applications';
import { signupSelectors } from '../state/ducks/signup';
import bemify from '../util/bemify';
import { startPoll, endPoll } from '../util/polling';

const { MAX_NODE_FILTER, MAX_EARNINGS_FILTER } = poolsConstants;
const {
  handleSort,
  getAllPools,
  setLocationFilter,
  setRatingFilter,
  setNodeCountFilter,
  setEarningsFilter,
} = poolsActions;
const { getApplicationAddresses } = applicationsSelectors
const {
  getFilteredPools,
  getPoolCount,
  getPoolSortDirection,
  getPoolSortColumn,
  getPoolLocationFilter,
  getPoolNodeCountFilter,
  getPoolRatingFilter,
  getPoolEarningsFilter,
} = poolsSelectors;
const { getSignupPoolIds } = signupSelectors;
const bem = bemify('pool-table');

export class BasePoolTable extends Component {
  constructor(props) {
    super(props);

    this.state = {
      rowPages: 1
    };

    const methods = [
      'getOnApply',
      'renderPricingTooltip',
      'renderNodesTooltip',
      'renderRatingTooltip',
      'renderLocationTooltip',
      'renderRow',
      'renderCheckbox'
    ];

    methods.forEach((method) => {
      this[method] = this[method].bind(this);
    });
  }

  componentWillMount() {
    startPoll('getPoolsPoolTable', this.props.getAllPools, 10000);
  }

  componentWillUnmount() {
    endPoll('getPoolsPoolTable');
  }

  getOnApply(hide, action) {
    return (value) => {
      action(value);
      hide();
    };
  }

  renderPricingTooltip(hide) {
    return (
      <SliderTooltip
        values={this.props.earningsFilter}
        min={0}
        max={MAX_EARNINGS_FILTER}
        onApply={this.getOnApply(hide, this.props.setEarningsFilter)}
        descriptionRenderer={([lo, hi]) => {
          if (hi >= MAX_EARNINGS_FILTER) {
            hi = `${MAX_EARNINGS_FILTER}+`
          }

          return (
            <div>
              <p className="mr-2">
                {lo} GLA/GB - {hi} GLA/GB
              </p>
              <p className="mr-2 text-muted">
                The average price is 50 GLA/GB
              </p>
            </div>
          );
        }}
      />
    );
  }

  renderNodesTooltip(hide) {
    return (
      <SliderTooltip
        values={this.props.nodeCountFilter}
        max={MAX_NODE_FILTER}
        onApply={this.getOnApply(hide, this.props.setNodeCountFilter)}
        descriptionRenderer={([lo, hi]) => {
          if (hi >= MAX_NODE_FILTER) {
            hi = `${MAX_NODE_FILTER}+`;
          }

          return (
            <p className="mr-2">
              {lo} - {hi} nodes
            </p>
          );
        }}
      />
    );
  }

  renderRatingTooltip(hide) {
    return (
      <RatingTooltip
        onApply={this.getOnApply(hide, this.props.setRatingFilter)}
        onClear={() => {this.props.setRatingFilter(0); hide()}}
        minRating={this.props.ratingFilter}
      />
    );
  }

  renderLocationTooltip(hide) {
    return (
      <CountryTooltip
        onApply={this.getOnApply(hide, this.props.setLocationFilter)}
        onClear={hide}
        selected={this.props.locationFilter}
      />
    );
  }

  renderEarnings(p) {
    if (p && p.earnings) {
      return (
        <span>
          <img src="./assets/images/icon-logo-small.svg" alt="" className="mr-2" />
          {p.earnings} GLA<span className="text-muted">/GB</span>
        </span>
      )
    }

    return '—';
  }

  renderCheckbox(pool, isSelected) {
    if (!this.props.allowSelection) {
      return null;
    }

    const hasApplied = this.props.poolsAppliedTo[pool.address];
    let checkbox;
    if (!hasApplied) {
      checkbox = (
        <BigRadioButton
          isCheckbox
          onClick={() => this.props.onRowClick(pool.address)}
          on={isSelected}
        />
      );
    } else {
      checkbox = (
        <img
          src="./assets/images/icon-info.svg"
        />
      );
    }

    return (
      <Table.Cell
        className="py-4 text-center"
      >
        <TooltipWrapper
          className={classnames(bem('tooltip'), 'ml-2')}
          content="You've already applied to this pool."
          disabled={!hasApplied}
          tooltipStyle={{
            width: '120px',
            maxWidth: '242px',
            top: '-70px',
            left: '-52px',
        }}>
          {checkbox}
        </TooltipWrapper>
      </Table.Cell>
    );
  }

  renderRow(p) {
    const { poolIds } = this.props;
    let isSelected = poolIds.indexOf(p.address) > -1;

    return (
      <Table.Row
        key={p.address}
        className={
          classnames(bem('pool-row'), {
            [bem('pool-row', 'selected')]: isSelected,
          })
        }
      >
        {this.renderCheckbox(p, isSelected)}
        <Table.Cell>{p.name || '—'}</Table.Cell>
        <Table.Cell>{p.location || '—'}</Table.Cell>
        <Table.Cell><StarRating rating={p.rating} /></Table.Cell>
        <Table.Cell>{p.nodeCount === '' ? '—' : p.nodeCount}</Table.Cell>
        <Table.Cell>
          {this.renderEarnings(p)}
        </Table.Cell>
      </Table.Row>
    );
  }

  renderRows(pools) {
    const rowsLimited = pools.slice(0, this.props.rowLimit * this.state.rowPages);
    return rowsLimited.map(this.renderRow);
  }

  renderShowMore(pools) {
    const { rowPages } = this.state;
    if (pools.length < (this.props.rowLimit * rowPages)) {
      return null;
    }

    return (
      <div
        onClick={() => this.setState({rowPages: rowPages + 1})}
        className={classnames(bem('show-rejected'), 'p-2')}
      >
        Show More
        <img src="./assets/images/icon-chevron-down.svg" alt="" />
      </div>
    );
  }

  renderTableHeader() {
    const {
      allowSelection,
      sortDirection,
      sortColumn,
    } = this.props;

    let firstColumn = null;
    if (allowSelection) {
      firstColumn = (
        <Table.HeaderCell className="blank" sorted="" />
      );
    }

    return (
      <Table.Header>
        <Table.Row>
          {firstColumn}
          <Table.HeaderCell
            className="name"
            sorted={sortColumn === 'name' ? sortDirection : ''}
            onClick={() => this.props.handleSort('name')}
          >
            Pool Name
          </Table.HeaderCell>
          <Table.HeaderCell
            className="location"
            sorted={sortColumn === 'location' ? sortDirection : ''}
            onClick={() => this.props.handleSort('location')}
          >
            Location
          </Table.HeaderCell>
          <Table.HeaderCell
            className="rating"
            sorted={sortColumn === 'rating' ? sortDirection : ''}
            onClick={() => this.props.handleSort('rating')}
          >
            Rating
          </Table.HeaderCell>
          <Table.HeaderCell
            className="nodeCount"
            sorted={sortColumn === 'nodeCount' ? sortDirection : ''}
            onClick={() => this.props.handleSort('nodeCount')}
          >
            Node Count
          </Table.HeaderCell>
          <Table.HeaderCell
            className="price"
            sorted={sortColumn === 'price' ? sortDirection : ''}
            onClick={() => this.props.handleSort('price')}
          >
            Monthy Earnings
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
    );
  }

  renderEmptyPools(pools) {
    if (pools.length === 0) {
      return (
        <div className="text-center text-muted p-3">
          There are currently no pools that match your criteria.
        </div>
      );
    }
  }

  render() {
    const {
      className,
      sortDirection,
      sortColumn,
      pools,
      poolIds,
      totalPools,
    } = this.props;

    return (
      <div className={classnames(bem(), className)}>
        <div className="row mb-3 align-items-center">
          <div className="col-2">
            <span className="font-italic">
              <span className="text-muted">Showing</span><br/>
              {
                pools.length === totalPools ?
                  'all pools' :
                  `${pools.length} of ${totalPools} pools`
              }
            </span>
          </div>
          <div className="col-10 text-right">
            <span className="text-muted mr-3">Filter by:</span>
            <Tooltip tooltip={this.renderRatingTooltip}>
              <FakeDropdown value="Rating" className="mr-2" />
            </Tooltip>
            <Tooltip tooltip={this.renderNodesTooltip}>
              <FakeDropdown value="Nodes" className="mr-2" />
            </Tooltip>
            <Tooltip tooltip={this.renderPricingTooltip}>
              <FakeDropdown value="Monthly Earnings" />
            </Tooltip>
          </div>
        </div>
        <Card noPadding>
          <Table className="table">
            {this.renderTableHeader()}
            <Table.Body>
              {this.renderRows(pools)}
            </Table.Body>
          </Table>
          {this.renderEmptyPools(pools)}
          {this.renderShowMore(pools)}
        </Card>
      </div>
    );
  }
}

BasePoolTable.defaultProps = {
  allowSelection: true,
  className: '',
  poolIds: [],
  sortColumn: 'name',
  sortDirection: 'asc',
  rowLimit: 5,
};

/* eslint react/no-unused-prop-types: "off" */
BasePoolTable.propTypes = {
  allowSelection: PropTypes.bool.isRequired,
  className: PropTypes.string,
  handleSort: PropTypes.func.isRequired,
  rowLimit: PropTypes.number,
  onRowClick: PropTypes.func.isRequired,
  getAllPools: PropTypes.func.isRequired,
  poolIds: PropTypes.arrayOf(PropTypes.string),
  pools: PropTypes.arrayOf(poolPropType).isRequired,
  sortColumn: PropTypes.string,
  sortDirection: PropTypes.string,
};

function mapStateToProps(state, ownProps) {
  return {
    poolsAppliedTo: getApplicationAddresses(state),
    poolIds: getSignupPoolIds(state),
    pools: getFilteredPools(state),
    totalPools: getPoolCount(state),
    sortDirection: getPoolSortDirection(state),
    sortColumn: getPoolSortColumn(state),
    locationFilter: getPoolLocationFilter(state),
    nodeCountFilter: getPoolNodeCountFilter(state),
    ratingFilter: getPoolRatingFilter(state),
    earningsFilter: getPoolEarningsFilter(state),
    allowSelection: ownProps.allowSelection,
    onRowClick: ownProps.onRowClick,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    handleSort: col => dispatch(handleSort(col)),
    getAllPools: () => dispatch(getAllPools()),
    setLocationFilter: (locations) => dispatch(setLocationFilter(locations)),
    setRatingFilter: (rating) => dispatch(setRatingFilter(rating)),
    setNodeCountFilter: (nodeCount) => dispatch(setNodeCountFilter(nodeCount)),
    setEarningsFilter: (earnings) => dispatch(setEarningsFilter(earnings)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(BasePoolTable);
