var _ = require('lodash')
var Table = require('../../table')
var moment = require('moment')
var utils = require('../../utils')
var uris = require('./uris')
var fmt = require('util').format
const withPagination = utils.withPagination

function contractList (session) {
  return function (args) {
    var self = this
    var getData = uris.contractsQuery(session, args.apiInstanceId, args)
    return session.get(getData)
      .then(function (response) {
        var table = new Table({
          head: [
            'Application', 'Client ID',
            'Current SLA tier', 'Requested SLA tier',
            'Status', 'Updated'
          ],
          colWidths: [30, null, 20, 20, null, 20]
        })
        var contracts = response.contracts
        _.each(contracts, function (contract) {
          var currTier = contract.tier ? contract.tier.name : 'N/A'
          var reqTier = contract.requestedTier ? contract.requestedTier.name : 'N/A'
          var updated = contract.audit.updated.date || contract.audit.created.date

          table.push([
            contract.application.name,
            contract.application.coreServicesId,
            currTier,
            reqTier,
            contract.status,
            moment.utc(updated).fromNow()
          ])
        })

        self._log(table)
        if (session.opts.interactive) {
          self.log(utils.composePaginationInfo(
            contracts.length, getData.qs.offset, response.total))
        }
      })
  }
}

function contractDelete (session) {
  return function (args) {
    var self = this
    return getContractByClientId.call(
          self, session, args.apiInstanceId, args.clientId)
      .then(function (contract) {
        var url = uris.contract(session, args.apiInstanceId, contract.id)
        return session.del(url)
      })
      .then(function () {
        self.log(fmt(
          'Contract deleted from API instance with ID "%s"',
          args.apiInstanceId))
      })
  }
}

function getContractByClientId (session, apiInstanceId, clientId) {
  var getData = uris.contractsClientIDQuery(
    session, apiInstanceId, clientId)
  return session.get(getData)
    .then(function (response) {
      var contract = response.contracts[0]
      if (contract === undefined) {
        return Promise.reject(fmt(
          'Contract with Client ID "%s" not found in API with ID "%s"',
          clientId, apiInstanceId))
      }
      return Promise.resolve(contract)
    })
}

module.exports = function (cli, session) {
  cli
    .command('api-mgr contract list <apiInstanceId> [searchText]',
             'Lists all contracts to a given API instance')
    .use(withPagination())
    .types({string: ['searchText']})
    .action(contractList(session))

  cli
    .command('api-mgr contract delete <apiInstanceId> <clientId>',
             'Delete a given API contract')
    .types({string: ['clientId']})
    .action(contractDelete(session))
}
