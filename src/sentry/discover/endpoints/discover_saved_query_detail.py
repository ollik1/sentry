from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.serializers import serialize
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.bases import OrganizationEndpoint
from sentry import features
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.models import DiscoverSavedQuery
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer


class DiscoverSavedQueryDetailEndpoint(OrganizationEndpoint):
    permission_classes = (DiscoverSavedQueryPermission,)

    def get(self, request, organization, query_id):
        """
        Get a saved query
        """
        if not features.has("organizations:discover", organization, actor=request.user):
            return self.respond(status=404)

        try:
            query = DiscoverSavedQuery.objects.get(id=query_id, organization=organization)
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(query), status=200)

    def put(self, request, organization, query_id):
        """
        Modify a saved query
        """
        if not features.has("organizations:discover", organization, actor=request.user):
            return self.respond(status=404)

        try:
            model = DiscoverSavedQuery.objects.get(id=query_id, organization=organization)
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = DiscoverSavedQuerySerializer(
            data=request.data, context={"organization": organization}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        model.update(organization=organization, name=data["name"], query=data["query"])

        model.set_projects(data["project_ids"])

        return Response(serialize(model), status=200)

    def delete(self, request, organization, query_id):
        """
        Delete a saved query
        """
        if not features.has("organizations:discover", organization, actor=request.user):
            return self.respond(status=404)

        try:
            model = DiscoverSavedQuery.objects.get(id=query_id, organization=organization)
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        model.delete()

        return Response(status=204)
