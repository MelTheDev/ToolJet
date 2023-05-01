import React, { Suspense } from 'react';
// eslint-disable-next-line no-unused-vars
import config from 'config';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  getWorkspaceIdFromURL,
  appendWorkspaceId,
  stripTrailingSlash,
  getSubpath,
  pathnameWithoutSubpath,
  retrieveWhiteLabelText,
} from '@/_helpers/utils';
import { authenticationService, tooljetService, organizationService } from '@/_services';
import { withRouter } from '@/_hoc/withRouter';
import { PrivateRoute, AdminRoute } from '@/_components';
import { HomePage } from '@/HomePage';
import { LoginPage } from '@/LoginPage';
import { SignupPage } from '@/SignupPage';
import { TooljetDatabase } from '@/TooljetDatabase';
import { OrganizationInvitationPage } from '@/ConfirmationPage';
import { Authorize } from '@/Oauth2';
import { Authorize as Oauth } from '@/Oauth';
import { Viewer } from '@/Editor';
import { OrganizationSettings } from '@/OrganizationSettingsPage';
import { AuditLogsPage } from '@/AuditLogs';
import { SettingsPage } from '../SettingsPage/SettingsPage';
import { ForgotPassword } from '@/ForgotPassword';
import { ResetPassword } from '@/ResetPassword';
import { MarketplacePage } from '@/MarketplacePage';
import SwitchWorkspacePage from '@/HomePage/SwitchWorkspacePage';
import { GlobalDatasources } from '@/GlobalDatasources';
import { lt } from 'semver';
import Toast from '@/_ui/Toast';
import { VerificationSuccessInfoScreen } from '@/SuccessInfoScreen';
import '@/_styles/theme.scss';
import { AppLoader } from '@/AppLoader';
import SetupScreenSelfHost from '../SuccessInfoScreen/SetupScreenSelfHost';
import { InstanceSettings } from '@/InstanceSettingsPage';
import posthog from 'posthog-js';

const AppWrapper = (props) => {
  return (
    <Suspense fallback={null}>
      <BrowserRouter basename={window.public_config?.SUB_PATH || '/'}>
        <AppWithRouter props={props} />
      </BrowserRouter>
    </Suspense>
  );
};

class AppComponent extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentUser: null,
      fetchedMetadata: false,
      darkMode: localStorage.getItem('darkMode') === 'true',
    };
  }

  fetchMetadata = () => {
    tooljetService.fetchMetaData().then((data) => {
      localStorage.setItem('currentVersion', data.installed_version);
      if (data.latest_version && lt(data.installed_version, data.latest_version) && data.version_ignored === false) {
        this.setState({ updateAvailable: true });
      }
    });
  };

  isThisExistedRoute = () => {
    const existedPaths = [
      'forgot-password',
      'reset-password',
      'invitations',
      'organization-invitations',
      'setup',
      'confirm',
      'confirm-invite',
    ];

    const pathnames = window.location.pathname.split('/')?.filter(path=> path!='');
    return pathnames?.length > 0 ? existedPaths.find((path) =>  pathnames[0] === path ) : false;
  };

  setFaviconAndTitle() {
    const favicon_url = window.public_config?.WHITE_LABEL_FAVICON;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = favicon_url ? favicon_url : 'assets/images/logo.svg';
    document.title = `${retrieveWhiteLabelText()} - Dashboard`;
  }

  initTelemetryAndSupport(currentUser) {
    function initFreshChat() {
      window.fcWidget.init({
        token: '0ef214a3-8ae1-41fb-b0d0-57764bf8f64b',
        host: 'https://wchat.freshchat.com',
        config: {
          cssNames: {
            widget: 'custom_fc_frame',
          },
          content: {
            actions: {
              push_notify_yes: 'Yes',
            },
          },
          headerProperty: {
            hideChatButton: true,
            direction: 'rtl',
          },
        },
      });

      window.fcWidget.user.setFirstName(`${currentUser.first_name} ${currentUser.last_name}`);

      window.fcWidget.user.setEmail(currentUser.email);
    }
    function initialize(i, t) {
      var e;
      i.getElementById(t)
        ? initFreshChat()
        : (((e = i.createElement('script')).id = t),
          (e.async = !0),
          (e.src = 'https://wchat.freshchat.com/js/widget.js'),
          (e.onload = initFreshChat),
          i.head.appendChild(e));
    }
    function initiateCall() {
      initialize(document, 'Freshdesk Messaging-js-sdk');
    }
    window.addEventListener
      ? window.addEventListener('load', initiateCall, !1)
      : window.attachEvent('load', initiateCall, !1);

    try {
      initiateCall();
    } catch (e) {
      console.log(e);
    }

    if (currentUser) {
      posthog.init('1OhSAF2367nMhuGI3cLvE6m5D0PJPBEA5zR5JFTM-yw', {
        api_host: 'https://app.posthog.com',
        autocapture: false,
      });
      posthog.identify(
        currentUser.email, // distinct_id, required
        { name: `${currentUser.first_name} ${currentUser.last_name}` }
      );
    }
  }

  componentDidMount() {
    this.setFaviconAndTitle();
    if (!this.isThisExistedRoute()) {
      const workspaceId = getWorkspaceIdFromURL();
      if (workspaceId) {
        this.authorizeUserAndHandleErrors(workspaceId);
      } else {
        const isApplicationsPath = window.location.pathname.includes('/applications/');
        const appId = isApplicationsPath ? pathnameWithoutSubpath(window.location.pathname).split('/')[2] : null;
        authenticationService
          .validateSession(appId)
          .then(({ current_organization_id, ...currentUser }) => {
            //check if the page is not switch-workspace, if then redirect to the page
            if (window.location.pathname !== `${getSubpath() ?? ''}/switch-workspace`) {
              this.authorizeUserAndHandleErrors(current_organization_id);
            } else {
              this.initTelemetryAndSupport(currentUser);
              this.updateCurrentSession({
                current_organization_id,
              });
            }
          })
          .catch(() => {
            if (!this.isThisWorkspaceLoginPage(true) && !isApplicationsPath) {
              this.updateCurrentSession({
                authentication_status: false,
              });
            } else if (isApplicationsPath) {
              this.updateCurrentSession({
                authentication_failed: true,
                load_app: true,
              });
            }
          });
      }
    }

    this.fetchMetadata();
    setInterval(this.fetchMetadata, 1000 * 60 * 60 * 1);
  }

  isThisWorkspaceLoginPage = (justLoginPage = false) => {
    const subpath = window?.public_config?.SUB_PATH ? stripTrailingSlash(window?.public_config?.SUB_PATH) : null;
    const pathname = location.pathname.replace(subpath, '');
    const pathnames = pathname.split('/').filter((path) => path !== '');
    return (justLoginPage && pathnames.includes('login')) || (pathnames.length === 2 && pathnames.includes('login'));
  };

  authorizeUserAndHandleErrors = (workspaceId) => {
    const subpath = getSubpath();
    this.updateCurrentSession({
      current_organization_id: workspaceId,
    });
    authenticationService
      .authorize()
      .then((data) => {
        this.initTelemetryAndSupport(data.current_user);
        organizationService.getOrganizations().then((response) => {
          const current_organization_name = response.organizations.find((org) => org.id === workspaceId)?.name;
          // this will add the other details like permission and user previlliage details to the subject
          this.updateCurrentSession({
            ...data,
            current_organization_name,
            organizations: response.organizations,
            load_app: true,
          });

          // if user is trying to load the workspace login page, then redirect to the dashboard
          if (this.isThisWorkspaceLoginPage())
            return (window.location = appendWorkspaceId(workspaceId, '/:workspaceId'));
        });
      })
      .catch((error) => {
        // if the auth token didn't contain workspace-id, try switch workspace fn
        if (error && error?.data?.statusCode === 401) {
          //get current session workspace id
          authenticationService
            .validateSession()
            .then(({ current_organization_id, ...currentUser }) => {
              // change invalid or not authorized org id to previous one
              this.updateCurrentSession({
                current_organization_id,
              });

              organizationService
                .switchOrganization(workspaceId)
                .then(() => {
                  if (this.isThisWorkspaceLoginPage())
                    return (window.location = appendWorkspaceId(workspaceId, '/:workspaceId'));
                  this.authorizeUserAndHandleErrors(workspaceId);
                })
                .catch(() => {
                  organizationService.getOrganizations().then((response) => {
                    const current_organization_name = response.organizations.find(
                      (org) => org.id === current_organization_id
                    )?.name;

                    this.updateCurrentSession({
                      current_organization_name,
                      load_app: true,
                    });

                    if (!this.isThisWorkspaceLoginPage())
                      return (window.location = `${subpath ?? ''}/login/${workspaceId}`);

                    this.initTelemetryAndSupport(currentUser);
                  });
                });
            })
            .catch(() => this.logout());
        } else if ((error && error?.data?.statusCode == 422) || error?.data?.statusCode == 404) {
          window.location = subpath ? `${subpath}${'/switch-workspace'}` : '/switch-workspace';
        } else {
          if (!this.isThisWorkspaceLoginPage() && !this.isThisWorkspaceLoginPage(true))
            this.updateCurrentSession({
              authentication_status: false,
            });
        }
      });
  };

  updateCurrentSession = (newSession) => {
    const currentSession = authenticationService.currentSessionValue;
    authenticationService.updateCurrentSession({ ...currentSession, ...newSession });
  };

  logout = () => {
    authenticationService.logout();
  };

  switchDarkMode = (newMode) => {
    this.setState({ darkMode: newMode });
    localStorage.setItem('darkMode', newMode);
  };

  render() {
    const { updateAvailable, darkMode } = this.state;
    let toastOptions = {
      style: {
        wordBreak: 'break-all',
      },
    };

    if (darkMode) {
      toastOptions = {
        className: 'toast-dark-mode',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
          wordBreak: 'break-all',
        },
      };
    }

    return (
      <>
        <div className={`main-wrapper ${darkMode ? 'theme-dark dark-theme' : ''}`} data-cy="main-wrapper">
          {updateAvailable && (
            <div className="alert alert-info alert-dismissible" role="alert">
              <h3 className="mb-1">Update available</h3>
              <p>A new version of ToolJet has been released.</p>
              <div className="btn-list">
                <a
                  href="https://docs.tooljet.io/docs/setup/updating"
                  target="_blank"
                  className="btn btn-info"
                  rel="noreferrer"
                >
                  Read release notes & update
                </a>
                <a
                  onClick={() => {
                    tooljetService.skipVersion();
                    this.setState({ updateAvailable: false });
                  }}
                  className="btn"
                >
                  Skip this version
                </a>
              </div>
            </div>
          )}
          <Routes>
            <Route path="/login/:organizationId" exact element={<LoginPage />} />
            <Route path="/login" exact element={<LoginPage />} />
            <Route path="/setup" exact element={<SetupScreenSelfHost {...this.props} darkMode={darkMode} />} />
            <Route path="/sso/:origin/:configId" exact element={<Oauth />} />
            <Route path="/sso/:origin" exact element={<Oauth />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invitations/:token" element={<VerificationSuccessInfoScreen />} />
            <Route
              path="/invitations/:token/workspaces/:organizationToken"
              element={<VerificationSuccessInfoScreen />}
            />
            <Route path="/confirm" element={<VerificationSuccessInfoScreen />} />
            <Route
              path="/organization-invitations/:token"
              element={<OrganizationInvitationPage {...this.props} darkMode={darkMode} />}
            />
            <Route
              path="/confirm-invite"
              element={<OrganizationInvitationPage {...this.props} darkMode={darkMode} />}
            />
            <Route
              exact
              path="/:workspaceId/apps/:id/:pageHandle?/*"
              element={
                <PrivateRoute>
                  <AppLoader switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/applications/:id/versions/:versionId/environments/:environmentId/:pageHandle?"
              element={
                <PrivateRoute>
                  <Viewer switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/applications/:slug/:pageHandle?"
              element={
                <PrivateRoute>
                  <Viewer switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/oauth2/authorize"
              element={
                <PrivateRoute>
                  <Authorize switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/:workspaceId/workspace-settings"
              element={
                <PrivateRoute>
                  <OrganizationSettings switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/instance-settings"
              element={
                <PrivateRoute>
                  <InstanceSettings switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/:workspaceId/audit-logs"
              element={
                <PrivateRoute>
                  <AuditLogsPage switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/:workspaceId/settings"
              element={
                <PrivateRoute>
                  <SettingsPage switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/:workspaceId/global-datasources"
              element={
                <PrivateRoute>
                  <GlobalDatasources switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            {window.public_config?.ENABLE_TOOLJET_DB == 'true' && (
              <Route
                exact
                path="/:workspaceId/database"
                element={
                  <PrivateRoute>
                    <TooljetDatabase switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                  </PrivateRoute>
                }
              />
            )}
            {window.public_config?.ENABLE_MARKETPLACE_FEATURE === 'true' && (
              <Route
                exact
                path="/integrations"
                element={
                  <AdminRoute>
                    <MarketplacePage switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                  </AdminRoute>
                }
              />
            )}
            <Route exact path="/" element={<Navigate to="/:workspaceId" />} />
            <Route
              exact
              path="/switch-workspace"
              element={
                <PrivateRoute>
                  <SwitchWorkspacePage switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              exact
              path="/:workspaceId"
              element={
                <PrivateRoute>
                  <HomePage switchDarkMode={this.switchDarkMode} darkMode={darkMode} />
                </PrivateRoute>
              }
            />
            <Route
              path="*"
              render={() => {
                if (authenticationService?.currentSessionValue?.current_organization_id) {
                  return <Navigate to="/:workspaceId" />;
                }
                return <Navigate to="/login" />;
              }}
            />
          </Routes>
          <div id="modal-div"></div>
        </div>
        <Toast toastOptions={toastOptions} />
      </>
    );
  }
}

export const App = AppWrapper;
const AppWithRouter = withRouter(AppComponent);
