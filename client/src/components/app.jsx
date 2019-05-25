import React, {Component, Fragment} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import history from '../routes/history';
import Spinner from './spinner/spinner';
import TopBar from './top-bar/top-bar';
import SideBar from './side-bar/side-bar';
import MessageEditor from './message-editor/message-editor';
import MessageList from './message-list/message-list';
import MessageViewer from './message-viewer/message-viewer';
import MessageSnackbar from './message-snackbar/message-snackbar';
import ComposeFabButton from './buttons/compose-fab-button';
import {clearUserCredentials} from '../actions/application';
import {AuthenticationException} from '../services/fetch';
import {editNewMessage} from '../services/application';
import {getFolders} from '../services/folder';
import {resetFolderMessagesCache} from '../services/message';
import mainCss from '../styles/main.scss';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sideBar: {
        collapsed: false
      }
    };
    this.toggleSideBar = this.toggleSideBar.bind(this);
  }

  render() {
    const {sideBar} = this.state;
    return (
      <div className={mainCss['main-layout']}>
        <Spinner
          visible={this.props.application.activeRequests > 0}
          className={mainCss['main-layout__spinner']} pathClassName={mainCss['spinner-path']}/>
        <TopBar sideBarCollapsed={sideBar.collapsed} sideBarToggle={this.toggleSideBar}/>
        <SideBar collapsed={sideBar.collapsed} sideBarToggle={this.toggleSideBar}/>
        <div className={mainCss['mdc-drawer-scrim']} onClick={this.toggleSideBar}></div>
        <div className={`${mainCss['mdc-top-app-bar--fixed-adjust']} ${mainCss['main-layout__content-wrapper']}
            ${sideBar.collapsed ? '' : mainCss['main-layout__content-wrapper--with-side-bar']}`}>
          {this.renderContent()}
        </div>
        <MessageSnackbar/>
      </div>
    );
  }

  renderContent() {
    const {application, outbox} = this.props;
    if (application.newMessage && Object.keys(application.newMessage).length > 0) {
      return <MessageEditor className={mainCss['main-layout__message-editor']} />;
    } else if (application.selectedMessage && Object.keys(application.selectedMessage).length > 0) {
      return <MessageViewer className={mainCss['main-layout__message-viewer']} />;
    }
    return (
      <Fragment>
        <MessageList className={mainCss['main-layout__message-list']} />
        <div className={mainCss['main-layout__fab-container']}>
          {outbox === null && <ComposeFabButton onClick={() => this.props.newMessage()}/>}
        </div>
      </Fragment>
    );
  }

  componentDidMount() {
    document.title = this.props.application.title;
    this.startPoll();
  }

  componentDidUpdate() {
    this.startPoll();
  }

  componentWillUnmount() {
    clearTimeout(this.refreshPollTimeout);
  }

  startPoll() {
    // Start polling when everything is ready
    if (this.props.application.selectedFolderId && Object.keys(this.props.folders.explodedItems).length > 0
      && !this.pollStarted) {
      this.pollStarted = true;
      this.refreshPoll();
    }
  }

  /**
   * Poll function that will refresh the folder list and the INBOX folder.
   *
   * @returns {Promise<void>}
   */
  async refreshPoll() {
    let keepPolling = true;
    try {
      const folderPromise = this.props.reloadFolders();
      const selectedFolder = this.props.folders.explodedItems[this.props.application.selectedFolderId] || {};
      const messagePromise = this.props.reloadMessageCache(selectedFolder);
      await Promise.all([folderPromise, messagePromise]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Error in refresh poll: ${e}`);
      if (e instanceof AuthenticationException) {
        keepPolling = false;
        this.props.logout();
      }
    }
    if (keepPolling) {
      this.refreshPollTimeout = setTimeout(this.refreshPoll.bind(this), this.props.application.pollInterval);
    }
  }

  toggleSideBar() {
    const toggleCollapsed = !this.state.sideBar.collapsed;
    this.setState({
      sideBar: {
        collapsed: toggleCollapsed
      }
    });
  }
}

App.propTypes = {
  application: PropTypes.object,
  outbox: PropTypes.object,
  folders: PropTypes.object,
  reloadFolders: PropTypes.func,
  reloadMessageCache: PropTypes.func,
  newMessage: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  application: state.application,
  outbox: state.application.outbox,
  folders: state.folders,
  messages: state.messages
});

const mapDispatchToProps = dispatch => ({
  reloadFolders: credentials => getFolders(dispatch, credentials, true),
  reloadMessageCache: (user, folder) => resetFolderMessagesCache(dispatch, user, folder),
  newMessage: () => editNewMessage(dispatch),
  logout: () => {
    dispatch(clearUserCredentials());
    history.push('/login');
  }
});

const mergeProps = (stateProps, dispatchProps, ownProps) => (Object.assign({}, stateProps, dispatchProps, ownProps, {
  reloadFolders: () => dispatchProps.reloadFolders(stateProps.application.user.credentials),
  reloadMessageCache: folder => dispatchProps.reloadMessageCache(stateProps.application.user, folder)
}));

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(App);
